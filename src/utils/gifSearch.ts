import type { GifResult } from "../types";

/**
 * Tìm GIF qua Tenor API.
 * Key lấy từ VITE_TENOR_API_KEY hoặc do người dùng tự nhập (lưu ở máy).
 * Không có key thì tab GIF vẫn cho dán link GIF thủ công.
 */
const KEY_STORAGE = "chat_tenor_key";

export function getGifApiKey(): string {
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored?.trim()) return stored.trim();
  return (import.meta.env.VITE_TENOR_API_KEY as string | undefined)?.trim() ?? "";
}

export function saveGifApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearGifApiKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

interface TenorFormat {
  url: string;
  dims?: [number, number];
}

interface TenorResult {
  id: string;
  content_description?: string;
  media_formats?: Record<string, TenorFormat>;
}

function toGifResult(item: TenorResult): GifResult | null {
  const full = item.media_formats?.gif ?? item.media_formats?.mediumgif;
  const preview = item.media_formats?.tinygif ?? full;
  if (!full || !preview) return null;
  return {
    id: item.id,
    url: full.url,
    previewUrl: preview.url,
    width: full.dims?.[0] ?? 200,
    height: full.dims?.[1] ?? 200,
    description: item.content_description ?? "GIF",
  };
}

export async function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  const key = getGifApiKey();
  if (!key) throw new Error("Chưa có Tenor API key");

  const base = query.trim()
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query.trim())}`
    : "https://tenor.googleapis.com/v2/featured?";
  const url = `${base}&key=${encodeURIComponent(key)}&limit=${limit}&media_filter=gif,tinygif&country=VN&locale=vi_VN`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Không tải được GIF. Kiểm tra lại API key.");

  const json = (await res.json()) as { results?: TenorResult[] };
  return (json.results ?? [])
    .map(toGifResult)
    .filter((g): g is GifResult => g !== null);
}

/** Cho phép gửi GIF bằng cách dán thẳng đường dẫn */
export function gifFromUrl(url: string): GifResult | null {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return {
    id: trimmed,
    url: trimmed,
    previewUrl: trimmed,
    width: 200,
    height: 200,
    description: "GIF",
  };
}
