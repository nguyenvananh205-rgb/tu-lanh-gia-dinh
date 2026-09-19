import { supabase } from "./supabase";
import type { ChatUser } from "../types";

interface DbChatUser {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  last_seen_at: string | null;
}

export function dbUserToApp(db: DbChatUser): ChatUser {
  return {
    id: db.id,
    displayName: db.display_name,
    avatarEmoji: db.avatar_emoji ?? "🙂",
    lastSeenAt: db.last_seen_at,
  };
}

/**
 * App không có màn hình đăng nhập: mỗi thiết bị được cấp một phiên ẩn danh
 * (Supabase anonymous sign-in). Phiên này được lưu lại nên mở lại app vẫn là
 * cùng một người.
 */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!created.user) throw new Error("Không tạo được phiên làm việc");
  return created.user.id;
}

export async function getMyProfile(userId: string): Promise<ChatUser | null> {
  const { data, error } = await supabase
    .from("chat_users")
    .select("id, display_name, avatar_emoji, last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? dbUserToApp(data as DbChatUser) : null;
}

export async function saveMyProfile(
  userId: string,
  displayName: string,
  avatarEmoji: string
): Promise<ChatUser> {
  const { data, error } = await supabase
    .from("chat_users")
    .upsert({
      id: userId,
      display_name: displayName.trim(),
      avatar_emoji: avatarEmoji,
      last_seen_at: new Date().toISOString(),
    })
    .select("id, display_name, avatar_emoji, last_seen_at")
    .single();
  if (error) throw error;
  return dbUserToApp(data as DbChatUser);
}

export async function touchLastSeen(userId: string): Promise<void> {
  await supabase
    .from("chat_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}

/** Những người đang dùng app — để chọn người bắt đầu chat 1-1 */
export async function listPeople(myId: string): Promise<ChatUser[]> {
  const { data, error } = await supabase
    .from("chat_users")
    .select("id, display_name, avatar_emoji, last_seen_at")
    .neq("id", myId)
    .order("last_seen_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as DbChatUser[]).map(dbUserToApp);
}
