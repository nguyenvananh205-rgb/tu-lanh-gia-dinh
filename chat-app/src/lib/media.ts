import { supabase } from "./supabase";
import { CHAT_BUCKET } from "./chat";
import type { ChatMessage } from "../types";

/**
 * Bucket chat-media để riêng tư, nên ảnh/video/voice phải mở bằng signed URL.
 * Link có hạn 1 giờ; ở đây cache lại và xin theo lô để không gọi server quá nhiều.
 */
const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 60_000;

const cache = new Map<string, { url: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<string | null>>();

function fresh(path: string): string | null {
  const hit = cache.get(path);
  if (hit && hit.expiresAt - REFRESH_BEFORE_MS > Date.now()) return hit.url;
  return null;
}

function remember(path: string, url: string) {
  cache.set(path, { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

/** Link đã có sẵn trong cache (dùng để render ngay, không cần chờ) */
export function cachedMediaUrl(path: string): string | null {
  return fresh(path);
}

export async function signedMediaUrl(path: string): Promise<string | null> {
  const ready = fresh(path);
  if (ready) return ready;

  const pending = inFlight.get(path);
  if (pending) return pending;

  const request = supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null;
      remember(path, data.signedUrl);
      return data.signedUrl;
    })
    .finally(() => inFlight.delete(path));

  inFlight.set(path, request);
  return request;
}

/** Xin trước link cho cả một trang tin nhắn bằng một lần gọi */
export async function prefetchMediaUrls(paths: string[]): Promise<void> {
  const missing = Array.from(new Set(paths.filter((p) => p && !fresh(p) && !inFlight.has(p))));
  if (missing.length === 0) return;

  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrls(missing, TTL_SECONDS);
  if (error || !data) return;

  for (const item of data) {
    if (item.signedUrl && item.path) remember(item.path, item.signedUrl);
  }
}

/** Đường dẫn dùng trực tiếp được (ảnh tạm khi đang gửi, hoặc GIF ở ngoài) */
export function directUrl(message: ChatMessage): string | undefined {
  const url = message.mediaUrl;
  if (!url) return undefined;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  // GIF lấy từ Tenor nằm ngoài storage nên không có media_path
  if (!message.mediaPath) return url;
  return undefined;
}

export function clearMediaUrlCache(): void {
  cache.clear();
}
