import { supabase } from "./supabase";
import type { AdminUser, ChatUser, UserStatus } from "../types";

interface DbChatUser {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  last_seen_at: string | null;
  status?: UserStatus;
  role?: "member" | "admin";
}

export function dbUserToApp(db: DbChatUser): ChatUser {
  return {
    id: db.id,
    displayName: db.display_name,
    avatarEmoji: db.avatar_emoji ?? "🙂",
    lastSeenAt: db.last_seen_at,
    status: db.status,
    role: db.role,
  };
}

const MY_PROFILE_COLUMNS = "id, display_name, avatar_emoji, last_seen_at, status, role";

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

// ── Mật khẩu ────────────────────────────────────────────────────
/** Gửi email chứa link đặt lại mật khẩu, link trỏ về chính app này */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

/** Đặt mật khẩu mới cho phiên hiện tại (dùng sau khi mở link đặt lại) */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Đổi mật khẩu khi đang đăng nhập: xác minh mật khẩu cũ trước */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (checkError) throw new Error("Mật khẩu hiện tại không đúng", { cause: checkError });
  await updatePassword(newPassword);
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
    .select(MY_PROFILE_COLUMNS)
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
    .select(MY_PROFILE_COLUMNS)
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
    .select(MY_PROFILE_COLUMNS)
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

// ── Quản trị (chỉ admin gọi được, server tự kiểm tra) ────────────
interface DbAdminUser {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  status: UserStatus;
  role: "member" | "admin";
  email: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export async function listUsersForAdmin(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbAdminUser[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji ?? "🙂",
    status: row.status,
    role: row.role,
    email: row.email ?? "",
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_status", {
    target: userId,
    new_status: status,
  });
  if (error) throw new Error(error.message);
}
