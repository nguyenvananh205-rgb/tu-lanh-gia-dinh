import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatUser,
  Conversation,
  GifResult,
  MessageKind,
  MessageQuote,
} from "../types";
import {
  dbMessageToApp,
  editMessage as dbEditMessage,
  getMessageById,
  getMessages,
  hideMessage,
  listConversations,
  markDelivered,
  markRead,
  recallMessage,
  sendMessage,
  subscribeConversation,
  subscribeInbox,
  uploadChatMedia,
  type SendMessageInput,
} from "../lib/chat";
import { newId } from "../lib/supabase";
import { kindFromMime, resolveStatus } from "../utils/format";
import type { VoiceRecording } from "./useVoiceRecorder";

interface SendOptions {
  replyTo?: ChatMessage | null;
}

export interface ChatOptions {
  /**
   * Gọi khi có tin nhắn mới từ người khác (kể cả khi đang ở box chat khác).
   * App dùng để bật thông báo trình duyệt.
   */
  onIncomingMessage?: (message: ChatMessage, senderName: string) => void;
}

export interface ChatState {
  conversations: Conversation[];
  conversationsLoading: boolean;
  totalUnread: number;
  activeId: string | null;
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  openConversation: (id: string) => void;
  closeConversation: () => void;
  loadOlder: () => Promise<void>;
  sendText: (text: string, options?: SendOptions) => Promise<void>;
  sendSticker: (stickerId: string, options?: SendOptions) => Promise<void>;
  sendGif: (gif: GifResult, options?: SendOptions) => Promise<void>;
  sendFiles: (files: File[], options?: SendOptions) => Promise<void>;
  sendVoice: (recording: VoiceRecording, options?: SendOptions) => Promise<void>;
  editText: (message: ChatMessage, body: string) => Promise<void>;
  recall: (message: ChatMessage) => Promise<void>;
  deleteForMe: (message: ChatMessage) => Promise<void>;
  retry: (message: ChatMessage) => Promise<void>;
  refresh: () => Promise<void>;
}

function quoteOf(message?: ChatMessage | null): MessageQuote | null {
  if (!message) return null;
  return {
    id: message.id,
    senderId: message.senderId,
    kind: message.kind,
    body: message.body,
    recalled: !!message.recalledAt,
  };
}

/** Tin nhắn bị thu hồi thì khung trả lời trỏ tới nó cũng mất nội dung */
function clearQuoteOf(message: ChatMessage, recalledId: string): ChatMessage {
  if (!message.replyTo || message.replyTo.id !== recalledId) return message;
  return { ...message, replyTo: { ...message.replyTo, recalled: true, body: undefined } };
}

export function useChat(me: ChatUser | null, options: ChatOptions = {}): ChatState {
  const myId = me?.id ?? "";
  const enabled = !!me;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rawMessages, setRawMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const pendingBlobUrls = useRef<string[]>([]);
  // Giữ callback trong ref để không phải đăng ký lại kênh realtime mỗi lần render
  const onIncomingRef = useRef(options.onIncomingMessage);
  const onIncomingMessage = options.onIncomingMessage;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    messagesRef.current = rawMessages;
  }, [rawMessages]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  useEffect(() => {
    const urls = pendingBlobUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // ── Danh sách hội thoại + danh sách người dùng ────────────────
  const loadConversations = useCallback(async () => {
    if (!enabled) return;
    setConversationsLoading(true);
    try {
      setConversations(await listConversations(myId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConversationsLoading(false);
    }
  }, [enabled, myId]);

  useEffect(() => {
    if (!enabled) return;
    void loadConversations();
  }, [enabled, loadConversations]);

  // ── Tin nhắn của hội thoại đang mở ────────────────────────────
  useEffect(() => {
    if (!enabled || !activeId) return;
    let cancelled = false;
    setMessagesLoading(true);

    getMessages(activeId, myId)
      .then(({ messages, hasMore: more }) => {
        if (cancelled) return;
        setRawMessages(messages);
        setHasMore(more);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, activeId, myId]);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!enabled) return;
      try {
        await markRead(conversationId, myId);
        const now = new Date().toISOString();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0, myLastReadAt: now } : c
          )
        );
      } catch (err) {
        console.error("Không cập nhật được trạng thái đã xem:", err);
      }
    },
    [enabled, myId]
  );

  useEffect(() => {
    if (!enabled || !activeId) return;
    void markConversationRead(activeId);
  }, [enabled, activeId, markConversationRead]);

  // ── Realtime cho hội thoại đang mở ────────────────────────────
  const upsertMessage = useCallback((message: ChatMessage) => {
    setRawMessages((prev) => {
      const index = prev.findIndex((m) => m.id === message.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...message };
        return next;
      }
      return [...prev, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  useEffect(() => {
    if (!enabled || !activeId) return;

    const channel = subscribeConversation(activeId, {
      onInsert: (row) => {
        const message = dbMessageToApp(row, myId);
        // Realtime không kèm tin nhắn được trả lời — lấy từ state hoặc hỏi lại server
        if (row.reply_to_id && !message.replyTo) {
          const known = messagesRef.current.find((m) => m.id === row.reply_to_id);
          if (known) {
            message.replyTo = quoteOf(known);
          } else {
            void getMessageById(row.reply_to_id, myId).then((original) => {
              if (!original) return;
              setRawMessages((prev) =>
                prev.map((m) => (m.id === row.id ? { ...m, replyTo: quoteOf(original) } : m))
              );
            });
          }
        }
        upsertMessage(message);
        if (row.sender_id !== myId) void markConversationRead(activeId);
      },
      onUpdate: (row) => {
        const message = dbMessageToApp(row, myId);
        setRawMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...message, replyTo: m.replyTo } : m))
        );
        if (row.recalled_at) {
          setRawMessages((prev) => prev.map((m) => clearQuoteOf(m, row.id)));
        }
      },
      onDelete: (id) => setRawMessages((prev) => prev.filter((m) => m.id !== id)),
      onMemberUpdate: (row) => {
        if (row.user_id === myId) return;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  partnerLastReadAt: row.last_read_at,
                  partnerLastDeliveredAt: row.last_delivered_at,
                }
              : c
          )
        );
      },
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [enabled, activeId, myId, upsertMessage, markConversationRead]);

  // ── Realtime toàn cục: badge chưa đọc & hội thoại mới ─────────
  useEffect(() => {
    if (!enabled) return;

    const channel = subscribeInbox(
      (row) => {
        if (row.sender_id === myId) return;

        let known = false;
        setConversations((prev) => {
          known = prev.some((c) => c.id === row.conversation_id);
          if (!known) return prev;
          return prev
            .map((c) =>
              c.id === row.conversation_id
                ? {
                    ...c,
                    lastMessage: dbMessageToApp(row, myId),
                    lastMessageAt: row.created_at,
                    unreadCount:
                      activeIdRef.current === row.conversation_id ? 0 : c.unreadCount + 1,
                  }
                : c
            )
            .sort(
              (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            );
        });

        // Tin nhắn của một box chat chưa có trong danh sách → nạp lại
        if (!known) {
          void loadConversations();
          return;
        }
        // Báo "đã nhận" kể cả khi đang ở box chat khác
        void markDelivered(row.conversation_id, myId).catch(() => undefined);

        const conversation = conversationsRef.current.find((c) => c.id === row.conversation_id);
        onIncomingRef.current?.(
          dbMessageToApp(row, myId),
          conversation?.partner?.displayName ?? "Tin nhắn mới"
        );
      },
      (_conversationId, userId) => {
        // Ai đó vừa dùng link mời của mình → box chat mới xuất hiện ngay
        if (userId === myId) void loadConversations();
      }
    );

    return () => {
      void channel.unsubscribe();
    };
  }, [enabled, myId, loadConversations]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  // ── Gửi tin nhắn (hiển thị lạc quan) ──────────────────────────
  const pushOptimistic = useCallback(
    (input: SendMessageInput, replyTo: ChatMessage | null, localUrl?: string): ChatMessage => {
      const optimistic: ChatMessage = {
        id: input.id ?? newId(),
        conversationId: input.conversationId,
        senderId: input.senderId,
        kind: input.kind,
        body: input.body,
        mediaUrl: localUrl ?? input.mediaUrl,
        mediaPath: input.mediaPath,
        mediaMime: input.mediaMime,
        mediaSize: input.mediaSize,
        durationMs: input.durationMs,
        waveform: input.waveform,
        replyToId: input.replyToId ?? null,
        replyTo: quoteOf(replyTo),
        editedAt: null,
        recalledAt: null,
        createdAt: new Date().toISOString(),
        status: "sending",
        pending: true,
      };
      setRawMessages((prev) => [...prev, optimistic]);
      return optimistic;
    },
    []
  );

  const markFailed = useCallback((id: string, message: string) => {
    setRawMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, pending: false, status: "failed", errorMessage: message } : m
      )
    );
    setError(message);
  }, []);

  const finalizeSend = useCallback(
    async (input: SendMessageInput, optimisticId: string) => {
      try {
        const saved = await sendMessage(input);
        setRawMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...saved, replyTo: m.replyTo ?? saved.replyTo, pending: false, status: "sent" }
              : m
          )
        );
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === input.conversationId
                ? { ...c, lastMessage: saved, lastMessageAt: saved.createdAt }
                : c
            )
            .sort(
              (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            )
        );
      } catch (err) {
        markFailed(optimisticId, (err as Error).message);
      }
    },
    [markFailed]
  );

  const send = useCallback(
    async (
      partial: Omit<SendMessageInput, "conversationId" | "senderId" | "id">,
      options?: SendOptions,
      localUrl?: string
    ) => {
      if (!enabled || !activeId) return;
      const input: SendMessageInput = {
        ...partial,
        id: newId(),
        conversationId: activeId,
        senderId: myId,
        replyToId: options?.replyTo?.id ?? null,
      };
      const optimistic = pushOptimistic(input, options?.replyTo ?? null, localUrl);
      await finalizeSend(input, optimistic.id);
    },
    [enabled, activeId, myId, pushOptimistic, finalizeSend]
  );

  const sendText = useCallback(
    async (text: string, options?: SendOptions) => {
      const body = text.trim();
      if (!body) return;
      await send({ kind: "text", body }, options);
    },
    [send]
  );

  const sendSticker = useCallback(
    async (stickerId: string, options?: SendOptions) => {
      await send({ kind: "sticker", body: stickerId }, options);
    },
    [send]
  );

  const sendGif = useCallback(
    async (gif: GifResult, options?: SendOptions) => {
      await send(
        { kind: "gif", mediaUrl: gif.url, mediaMime: "image/gif", body: gif.description },
        options
      );
    },
    [send]
  );

  const sendFiles = useCallback(
    async (files: File[], options?: SendOptions) => {
      if (!enabled || !activeId) return;

      for (const file of files) {
        const kind: MessageKind = kindFromMime(file.type);
        const localUrl = URL.createObjectURL(file);
        pendingBlobUrls.current.push(localUrl);

        const input: SendMessageInput = {
          id: newId(),
          conversationId: activeId,
          senderId: myId,
          kind,
          mediaMime: file.type,
          mediaSize: file.size,
          replyToId: options?.replyTo?.id ?? null,
        };
        const optimistic = pushOptimistic(input, options?.replyTo ?? null, localUrl);

        try {
          const uploaded = await uploadChatMedia(activeId, file, file.name);
          await finalizeSend(
            { ...input, mediaUrl: uploaded.url, mediaPath: uploaded.path, mediaMime: uploaded.mime },
            optimistic.id
          );
        } catch (err) {
          markFailed(optimistic.id, (err as Error).message);
        }
      }
    },
    [enabled, activeId, myId, pushOptimistic, finalizeSend, markFailed]
  );

  const sendVoice = useCallback(
    async (recording: VoiceRecording, options?: SendOptions) => {
      if (!enabled || !activeId) return;

      const localUrl = URL.createObjectURL(recording.blob);
      pendingBlobUrls.current.push(localUrl);

      const input: SendMessageInput = {
        id: newId(),
        conversationId: activeId,
        senderId: myId,
        kind: "voice",
        mediaMime: recording.mimeType,
        mediaSize: recording.blob.size,
        durationMs: recording.durationMs,
        waveform: recording.waveform,
        replyToId: options?.replyTo?.id ?? null,
      };
      const optimistic = pushOptimistic(input, options?.replyTo ?? null, localUrl);

      try {
        const uploaded = await uploadChatMedia(activeId, recording.blob, recording.fileName);
        await finalizeSend(
          { ...input, mediaUrl: uploaded.url, mediaPath: uploaded.path },
          optimistic.id
        );
      } catch (err) {
        markFailed(optimistic.id, (err as Error).message);
      }
    },
    [enabled, activeId, myId, pushOptimistic, finalizeSend, markFailed]
  );

  const retry = useCallback(
    async (message: ChatMessage) => {
      if (message.status !== "failed") return;
      setRawMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, status: "sending", pending: true, errorMessage: undefined }
            : m
        )
      );
      await finalizeSend(
        {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          kind: message.kind,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mediaPath: message.mediaPath,
          mediaMime: message.mediaMime,
          mediaSize: message.mediaSize,
          durationMs: message.durationMs,
          waveform: message.waveform,
          replyToId: message.replyToId ?? null,
        },
        message.id
      );
    },
    [finalizeSend]
  );

  // ── Chỉnh sửa / thu hồi / xoá ─────────────────────────────────
  const editText = useCallback(async (message: ChatMessage, body: string) => {
    const trimmed = body.trim();
    if (!trimmed || trimmed === message.body) return;
    const editedAt = new Date().toISOString();
    setRawMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, body: trimmed, editedAt } : m))
    );
    try {
      await dbEditMessage(message.id, trimmed);
    } catch (err) {
      setRawMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, body: message.body, editedAt: message.editedAt } : m
        )
      );
      setError((err as Error).message);
    }
  }, []);

  const recall = useCallback(async (message: ChatMessage) => {
    const recalledAt = new Date().toISOString();
    setRawMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              recalledAt,
              body: undefined,
              mediaUrl: undefined,
              mediaPath: undefined,
              waveform: undefined,
              durationMs: undefined,
            }
          : clearQuoteOf(m, message.id)
      )
    );
    try {
      await recallMessage(message);
    } catch (err) {
      setError((err as Error).message);
      setRawMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    }
  }, []);

  const deleteForMe = useCallback(
    async (message: ChatMessage) => {
      setRawMessages((prev) => prev.filter((m) => m.id !== message.id));
      if (message.pending || message.status === "failed") return;
      try {
        await hideMessage(message.id, message.conversationId, myId);
      } catch (err) {
        setError((err as Error).message);
        setRawMessages((prev) =>
          [...prev, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        );
      }
    },
    [myId]
  );

  // ── Điều hướng ────────────────────────────────────────────────
  const openConversation = useCallback((id: string) => setActiveId(id), []);
  const closeConversation = useCallback(() => setActiveId(null), []);

  const loadOlder = useCallback(async () => {
    if (!enabled || !activeId || !hasMore || loadingMore) return;
    const oldest = rawMessages[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const { messages: older, hasMore: more } = await getMessages(
        activeId,
        myId,
        oldest.createdAt
      );
      setRawMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      setHasMore(more);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, activeId, hasMore, loadingMore, rawMessages, myId]);

  const refresh = useCallback(async () => {
    await loadConversations();
    if (activeId) {
      const { messages, hasMore: more } = await getMessages(activeId, myId);
      setRawMessages(messages);
      setHasMore(more);
    }
  }, [loadConversations, activeId, myId]);

  // Chỉ giữ tin nhắn của hội thoại đang mở, kèm trạng thái đã gửi/đã nhận/đã xem
  const messages = useMemo(() => {
    if (!enabled || !activeId) return [];
    const deliveredAt = activeConversation?.partnerLastDeliveredAt ?? null;
    const readAt = activeConversation?.partnerLastReadAt ?? null;
    return rawMessages
      .filter((m) => m.conversationId === activeId)
      .map((m) =>
        m.senderId === myId ? { ...m, status: resolveStatus(m, deliveredAt, readAt) } : m
      );
  }, [enabled, activeId, rawMessages, activeConversation, myId]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return {
    conversations,
    conversationsLoading,
    totalUnread,
    activeId,
    activeConversation,
    messages,
    messagesLoading,
    hasMore: activeId ? hasMore : false,
    loadingMore,
    error,
    openConversation,
    closeConversation,
    loadOlder,
    sendText,
    sendSticker,
    sendGif,
    sendFiles,
    sendVoice,
    editText,
    recall,
    deleteForMe,
    retry,
    refresh,
  };
}
