export type MessageKind = "text" | "image" | "video" | "voice" | "sticker" | "gif";

/** Trạng thái của tin nhắn mình gửi đi (chức năng "đã gửi/đã nhận/đã xem") */
export type MessageStatus = "sending" | "sent" | "delivered" | "seen" | "failed";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "member" | "admin";

export interface ChatUser {
  id: string;
  displayName: string;
  avatarEmoji: string;
  lastSeenAt?: string | null;
  /** Chỉ có với hồ sơ của chính mình */
  status?: UserStatus;
  role?: UserRole;
}

/** Dòng trong trang quản trị (chỉ admin đọc được, kèm email) */
export interface AdminUser {
  id: string;
  displayName: string;
  avatarEmoji: string;
  status: UserStatus;
  role: UserRole;
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
}

/** Tóm tắt tin nhắn được trả lời, hiển thị trong khung quote */
export interface MessageQuote {
  id: string;
  senderId: string;
  kind: MessageKind;
  body?: string;
  recalled: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body?: string; // nội dung text / chú thích / mã sticker
  mediaUrl?: string;
  mediaPath?: string;
  mediaMime?: string;
  mediaSize?: number;
  durationMs?: number;
  waveform?: number[];
  replyToId?: string | null;
  replyTo?: MessageQuote | null;
  editedAt?: string | null;
  recalledAt?: string | null;
  createdAt: string;
  /** Chỉ có ý nghĩa với tin nhắn của chính mình */
  status: MessageStatus;
  /** true khi tin nhắn mới chỉ nằm ở máy, chưa được server xác nhận */
  pending?: boolean;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  title?: string | null;
  members: ChatUser[];
  /** Người còn lại trong chat 1-1 */
  partner: ChatUser | null;
  lastMessage: ChatMessage | null;
  lastMessageAt: string;
  unreadCount: number;
  myLastReadAt: string | null;
  partnerLastReadAt: string | null;
  partnerLastDeliveredAt: string | null;
}

export interface Sticker {
  id: string;
  emoji: string;
  label: string;
  pack: string;
}

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  description: string;
}
