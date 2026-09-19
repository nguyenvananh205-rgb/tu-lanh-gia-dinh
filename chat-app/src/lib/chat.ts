/**
 * Truy vấn Supabase cho toàn bộ chức năng nhắn tin.
 * Schema tương ứng: supabase/schema.sql
 */
import { newId, supabase } from "./supabase";
import { dbUserToApp } from "./users";
import type { ChatMessage, ChatUser, Conversation, MessageKind, MessageQuote } from "../types";

export const CHAT_BUCKET = "chat-media";
export const PAGE_SIZE = 40;
/** 25 MB — trùng file_size_limit của bucket chat-media */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_url: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_size: number | null;
  duration_ms: number | null;
  waveform: number[] | null;
  reply_to_id: string | null;
  edited_at: string | null;
  recalled_at: string | null;
  created_at: string;
  reply_to?: {
    id: string;
    sender_id: string;
    kind: MessageKind;
    body: string | null;
    recalled_at: string | null;
  } | null;
}

interface DbChatUserRow {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  last_seen_at: string | null;
}

interface DbMemberRow {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  last_delivered_at: string | null;
  profile: DbChatUserRow | DbChatUserRow[] | null;
}

const MESSAGE_SELECT =
  "*, reply_to:messages!messages_reply_to_id_fkey(id, sender_id, kind, body, recalled_at)";

// ── Mapping ─────────────────────────────────────────────────────
export function dbMessageToApp(db: DbMessage, myId: string): ChatMessage {
  const quote: MessageQuote | null = db.reply_to
    ? {
        id: db.reply_to.id,
        senderId: db.reply_to.sender_id,
        kind: db.reply_to.kind,
        body: db.reply_to.body ?? undefined,
        recalled: !!db.reply_to.recalled_at,
      }
    : null;

  return {
    id: db.id,
    conversationId: db.conversation_id,
    senderId: db.sender_id,
    kind: db.kind,
    body: db.body ?? undefined,
    mediaUrl: db.media_url ?? undefined,
    mediaPath: db.media_path ?? undefined,
    mediaMime: db.media_mime ?? undefined,
    mediaSize: db.media_size ?? undefined,
    durationMs: db.duration_ms ?? undefined,
    waveform: db.waveform ?? undefined,
    replyToId: db.reply_to_id,
    replyTo: quote,
    editedAt: db.edited_at,
    recalledAt: db.recalled_at,
    createdAt: db.created_at,
    // Trạng thái thật được tính lại ở useChat theo mốc đã nhận/đã xem của đối phương
    status: db.sender_id === myId ? "sent" : "seen",
  };
}

/** PostgREST có thể trả object hoặc mảng cho quan hệ nhúng */
function firstProfile(value: DbMemberRow["profile"]): DbChatUserRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// ── Hội thoại ───────────────────────────────────────────────────
export async function listConversations(userId: string): Promise<Conversation[]> {
  const { data: myRows, error: myError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  if (myError) throw myError;

  const ids = ((myRows ?? []) as { conversation_id: string }[]).map((r) => r.conversation_id);
  if (ids.length === 0) return [];

  const { data: convRows, error: convError } = await supabase
    .from("conversations")
    .select("id, type, title, last_message_at")
    .in("id", ids)
    .order("last_message_at", { ascending: false });
  if (convError) throw convError;

  const conversations = (convRows ?? []) as {
    id: string;
    type: "direct" | "group";
    title: string | null;
    last_message_at: string;
  }[];
  if (conversations.length === 0) return [];

  const convIds = conversations.map((c) => c.id);
  const { data: memberRows, error: memberError } = await supabase
    .from("conversation_members")
    .select(
      "conversation_id, user_id, last_read_at, last_delivered_at, profile:chat_users(id, display_name, avatar_emoji, last_seen_at)"
    )
    .in("conversation_id", convIds);
  if (memberError) throw memberError;

  const membersByConv = new Map<string, DbMemberRow[]>();
  for (const row of (memberRows ?? []) as DbMemberRow[]) {
    const list = membersByConv.get(row.conversation_id) ?? [];
    list.push(row);
    membersByConv.set(row.conversation_id, list);
  }

  return Promise.all(
    conversations.map(async (conv) => {
      const rows = membersByConv.get(conv.id) ?? [];
      const mine = rows.find((r) => r.user_id === userId);
      const partnerRow = rows.find((r) => r.user_id !== userId);
      const partnerProfile = partnerRow ? firstProfile(partnerRow.profile) : null;

      const members: ChatUser[] = rows
        .map((r) => firstProfile(r.profile))
        .filter((p): p is DbChatUserRow => !!p)
        .map(dbUserToApp);

      const [lastMessage, unreadCount] = await Promise.all([
        getLastMessage(conv.id, userId),
        countUnread(conv.id, userId, mine?.last_read_at ?? null),
      ]);

      const conversation: Conversation = {
        id: conv.id,
        type: conv.type,
        title: conv.title,
        members,
        partner: partnerProfile ? dbUserToApp(partnerProfile) : null,
        lastMessage,
        lastMessageAt: conv.last_message_at,
        unreadCount,
        myLastReadAt: mine?.last_read_at ?? null,
        partnerLastReadAt: partnerRow?.last_read_at ?? null,
        partnerLastDeliveredAt: partnerRow?.last_delivered_at ?? null,
      };
      return conversation;
    })
  );
}

async function getLastMessage(conversationId: string, userId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as DbMessage[];
  return rows.length > 0 ? dbMessageToApp(rows[0], userId) : null;
}

async function countUnread(
  conversationId: string,
  userId: string,
  lastReadAt: string | null
): Promise<number> {
  let query = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId);
  if (lastReadAt) query = query.gt("created_at", lastReadAt);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

// ── Tin nhắn ────────────────────────────────────────────────────
export async function getHiddenMessageIds(
  conversationId: string,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("message_hides")
    .select("message_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) return new Set();
  return new Set(((data ?? []) as { message_id: string }[]).map((r) => r.message_id));
}

/** Một trang tin nhắn, sắp xếp cũ → mới */
export async function getMessages(
  conversationId: string,
  userId: string,
  before?: string
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  let query = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) query = query.lt("created_at", before);

  const [{ data, error }, hidden] = await Promise.all([
    query,
    getHiddenMessageIds(conversationId, userId),
  ]);
  if (error) throw error;

  const rows = (data ?? []) as DbMessage[];
  const messages = rows
    .filter((row) => !hidden.has(row.id))
    .map((row) => dbMessageToApp(row, userId))
    .reverse();

  return { messages, hasMore: rows.length === PAGE_SIZE };
}

export async function getMessageById(id: string, userId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return dbMessageToApp(data as DbMessage, userId);
}

export interface SendMessageInput {
  id?: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body?: string;
  mediaUrl?: string;
  mediaPath?: string;
  mediaMime?: string;
  mediaSize?: number;
  durationMs?: number;
  waveform?: number[];
  replyToId?: string | null;
}

export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      kind: input.kind,
      body: input.body ?? null,
      media_url: input.mediaUrl ?? null,
      media_path: input.mediaPath ?? null,
      media_mime: input.mediaMime ?? null,
      media_size: input.mediaSize ?? null,
      duration_ms: input.durationMs ?? null,
      waveform: input.waveform ?? null,
      reply_to_id: input.replyToId ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  return dbMessageToApp(data as DbMessage, input.senderId);
}

/** Chỉnh sửa tin nhắn văn bản của chính mình */
export async function editMessage(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Thu hồi với mọi người: xoá nội dung, giữ vết "đã thu hồi" */
export async function recallMessage(message: ChatMessage): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({
      recalled_at: new Date().toISOString(),
      body: null,
      media_url: null,
      media_path: null,
      media_mime: null,
      media_size: null,
      duration_ms: null,
      waveform: null,
    })
    .eq("id", message.id);
  if (error) throw error;

  if (message.mediaPath) {
    await supabase.storage.from(CHAT_BUCKET).remove([message.mediaPath]);
  }
}

/** Xóa ở phía tôi: chỉ ẩn với người thực hiện */
export async function hideMessage(
  messageId: string,
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.from("message_hides").upsert({
    message_id: messageId,
    conversation_id: conversationId,
    user_id: userId,
  });
  if (error) throw error;
}

// ── Đã nhận / đã xem ────────────────────────────────────────────
export async function markDelivered(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_delivered_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: now, last_delivered_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Tải ảnh / video / voice lên storage ─────────────────────────
export interface UploadedMedia {
  /** Đường dẫn trong bucket riêng tư; link xem được tạo bằng signed URL */
  path: string;
  mime: string;
  size: number;
}

export async function uploadChatMedia(
  conversationId: string,
  file: File | Blob,
  fileName: string
): Promise<UploadedMedia> {
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error("File vượt quá 25 MB");
  }
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const path = `${conversationId}/${newId()}.${ext}`;

  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  return {
    path,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}

// ── Realtime ────────────────────────────────────────────────────
export interface ConversationHandlers {
  onInsert: (message: DbMessage) => void;
  onUpdate: (message: DbMessage) => void;
  onDelete: (id: string) => void;
  onMemberUpdate: (row: {
    user_id: string;
    last_read_at: string | null;
    last_delivered_at: string | null;
  }) => void;
}

export function subscribeConversation(conversationId: string, handlers: ConversationHandlers) {
  const filter = `conversation_id=eq.${conversationId}`;
  return supabase
    .channel(`chat:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter },
      (payload) => handlers.onInsert(payload.new as DbMessage)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter },
      (payload) => handlers.onUpdate(payload.new as DbMessage)
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages", filter },
      (payload) => handlers.onDelete((payload.old as { id: string }).id)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "conversation_members", filter },
      (payload) =>
        handlers.onMemberUpdate(
          payload.new as {
            user_id: string;
            last_read_at: string | null;
            last_delivered_at: string | null;
          }
        )
    )
    .subscribe();
}

/**
 * Mọi thay đổi RLS cho phép thấy: tin nhắn mới (badge chưa đọc) và việc mình được
 * thêm vào một box chat mới (người khác vừa dùng link mời của mình).
 */
export function subscribeInbox(
  onMessage: (message: DbMessage) => void,
  onJoinedConversation: (conversationId: string, userId: string) => void
) {
  return supabase
    .channel("chat:inbox")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) =>
      onMessage(payload.new as DbMessage)
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "conversation_members" },
      (payload) => {
        const row = payload.new as { conversation_id: string; user_id: string };
        onJoinedConversation(row.conversation_id, row.user_id);
      }
    )
    .subscribe();
}
