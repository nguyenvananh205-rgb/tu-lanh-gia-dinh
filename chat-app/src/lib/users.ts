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

/** Lỗi Postgres khi tên hiển thị bị trùng */
const UNIQUE_VIOLATION = "23505";

// ── Đăng ký / đăng nhập ─────────────────────────────────────────
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Hồ sơ ───────────────────────────────────────────────────────
/**
 * Hồ sơ được trigger `handle_new_user` tạo ngay khi đăng ký, kèm tên hiển thị
 * mặc định do hệ thống sinh và không trùng với ai. Trong trường hợp hiếm gặp
 * (đăng ký trước khi chạy schema) thì tạo bù ở đây.
 */
export async function getMyProfile(userId: string): Promise<ChatUser | null> {
  const { data, error } = await supabase
    .from("chat_users")
    .select("id, display_name, avatar_emoji, last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? dbUserToApp(data as DbChatUser) : null;
}

export async function createFallbackProfile(userId: string): Promise<ChatUser> {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const { data, error } = await supabase
    .from("chat_users")
    .insert({ id: userId, display_name: `Người dùng ${suffix}` })
    .select("id, display_name, avatar_emoji, last_seen_at")
    .single();
  if (error) throw error;
  return dbUserToApp(data as DbChatUser);
}

export class DisplayNameTakenError extends Error {
  constructor() {
    super("Tên hiển thị này đã có người dùng, hãy chọn tên khác");
    this.name = "DisplayNameTakenError";
  }
}

/** Đổi tên hiển thị / ảnh đại diện. Tên trùng sẽ bị từ chối. */
export async function updateMyProfile(
  userId: string,
  displayName: string,
  avatarEmoji: string
): Promise<ChatUser> {
  const { data, error } = await supabase
    .from("chat_users")
    .update({ display_name: displayName.trim(), avatar_emoji: avatarEmoji })
    .eq("id", userId)
    .select("id, display_name, avatar_emoji, last_seen_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DisplayNameTakenError();
    throw error;
  }
  return dbUserToApp(data as DbChatUser);
}

export async function touchLastSeen(userId: string): Promise<void> {
  await supabase
    .from("chat_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
