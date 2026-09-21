import { supabase } from "./supabase";

export interface ChatInvite {
  token: string;
  expiresAt: string;
  uses: number;
}

interface DbInvite {
  token: string;
  expires_at: string;
  uses: number;
}

const INVITE_PARAM = "invite";
const PENDING_KEY = "pending_invite_token";

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Link mời đang còn hiệu lực của tôi; chưa có thì tạo mới */
export async function getOrCreateMyInvite(userId: string): Promise<ChatInvite> {
  const { data, error } = await supabase
    .from("chat_invites")
    .select("token, expires_at, uses")
    .eq("owner_id", userId)
    .eq("revoked", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const rows = (data ?? []) as DbInvite[];
  if (rows.length > 0) {
    return { token: rows[0].token, expiresAt: rows[0].expires_at, uses: rows[0].uses };
  }
  return createInvite(userId);
}

export async function createInvite(userId: string): Promise<ChatInvite> {
  const { data, error } = await supabase
    .from("chat_invites")
    .insert({ token: randomToken(), owner_id: userId })
    .select("token, expires_at, uses")
    .single();
  if (error) throw error;
  const row = data as DbInvite;
  return { token: row.token, expiresAt: row.expires_at, uses: row.uses };
}

/** Thu hồi mọi link cũ rồi tạo link mới */
export async function regenerateInvite(userId: string): Promise<ChatInvite> {
  const { error } = await supabase
    .from("chat_invites")
    .update({ revoked: true })
    .eq("owner_id", userId)
    .eq("revoked", false);
  if (error) throw error;
  return createInvite(userId);
}

export function inviteUrl(token: string): string {
  const url = new URL(window.location.href);
  url.search = `?${INVITE_PARAM}=${token}`;
  url.hash = "";
  return url.toString();
}

/**
 * Nhận link mời → tạo (hoặc lấy lại) box chat 1-1 với người mời.
 * Toàn bộ kiểm tra hạn dùng / thu hồi nằm trong hàm accept_invite ở database.
 */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Đọc ?invite=... trên URL và cất lại (localStorage, để còn dùng được sau khi
 * admin duyệt tài khoản, có thể là vài ngày sau).
 */
export function captureInviteFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get(INVITE_PARAM);
  if (token) {
    localStorage.setItem(PENDING_KEY, token);
    window.history.replaceState({}, "", window.location.pathname);
    return token;
  }
  return localStorage.getItem(PENDING_KEY);
}

export function clearPendingInvite(): void {
  localStorage.removeItem(PENDING_KEY);
}
