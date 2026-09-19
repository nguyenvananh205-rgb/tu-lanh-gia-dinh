import { format, isToday, isYesterday, parseISO, isValid } from "date-fns";
import type { ChatMessage, ChatUser, MessageKind, MessageStatus } from "../types";

function safeParse(iso: string): Date | null {
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** Giờ hiển thị cạnh bong bóng chat: "14:32" */
export function formatClock(iso: string): string {
  const d = safeParse(iso);
  return d ? format(d, "HH:mm") : "";
}

/** Dải phân cách ngày giữa các nhóm tin nhắn */
export function formatDayDivider(iso: string): string {
  const d = safeParse(iso);
  if (!d) return "";
  if (isToday(d)) return "Hôm nay";
  if (isYesterday(d)) return "Hôm qua";
  return format(d, "dd/MM/yyyy");
}

/** Thời gian rút gọn trong danh sách hội thoại */
export function formatConversationTime(iso: string): string {
  const d = safeParse(iso);
  if (!d) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Hôm qua";
  return format(d, "dd/MM");
}

/** 7200 → "0:07" (voice/video) */
export function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(size?: number): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tên hiển thị: ưu tiên display_name, nếu không có thì dùng số điện thoại */
export function displayName(user: ChatUser | null | undefined): string {
  if (!user) return "Người dùng";
  if (user.display_name?.trim()) return user.display_name.trim();
  if (user.phone) return user.phone.startsWith("+84") ? `0${user.phone.slice(3)}` : user.phone;
  return "Người dùng";
}

export function initialsOf(user: ChatUser | null | undefined): string {
  const name = displayName(user);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.slice(-2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const KIND_LABELS: Record<MessageKind, string> = {
  text: "",
  image: "🖼️ Hình ảnh",
  video: "🎬 Video",
  voice: "🎤 Tin nhắn thoại",
  sticker: "😀 Sticker",
  gif: "✨ GIF",
};

/** Dòng xem trước trong danh sách hội thoại */
export function messagePreview(message: ChatMessage | null, myId: string): string {
  if (!message) return "Chưa có tin nhắn nào";
  const prefix = message.senderId === myId ? "Bạn: " : "";
  if (message.recalledAt) return `${prefix}Tin nhắn đã được thu hồi`;
  if (message.kind === "text") return `${prefix}${message.body ?? ""}`;
  const label = KIND_LABELS[message.kind];
  return `${prefix}${message.body ? `${label} · ${message.body}` : label}`;
}

/** Nội dung ngắn hiển thị trong khung trả lời (quote) */
export function quotePreview(kind: MessageKind, body?: string, recalled?: boolean): string {
  if (recalled) return "Tin nhắn đã được thu hồi";
  if (kind === "text") return body ?? "";
  return body ? `${KIND_LABELS[kind]} · ${body}` : KIND_LABELS[kind];
}

/**
 * Trạng thái "đã gửi / đã nhận / đã xem" của một tin nhắn mình gửi,
 * suy ra từ mốc last_delivered_at & last_read_at của người nhận.
 */
export function resolveStatus(
  message: ChatMessage,
  partnerLastDeliveredAt: string | null,
  partnerLastReadAt: string | null
): MessageStatus {
  if (message.pending) return "sending";
  if (message.status === "failed") return "failed";
  const created = new Date(message.createdAt).getTime();
  if (partnerLastReadAt && new Date(partnerLastReadAt).getTime() >= created) return "seen";
  if (partnerLastDeliveredAt && new Date(partnerLastDeliveredAt).getTime() >= created) {
    return "delivered";
  }
  return "sent";
}

export const STATUS_LABELS: Record<MessageStatus, string> = {
  sending: "Đang gửi",
  sent: "Đã gửi",
  delivered: "Đã nhận",
  seen: "Đã xem",
  failed: "Gửi lỗi",
};

/** Loại tin nhắn suy ra từ MIME type của file được chọn */
export function kindFromMime(mime: string): MessageKind {
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return "image";
}
