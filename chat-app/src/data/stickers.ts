import type { Sticker } from "../types";

/**
 * Sticker dựng sẵn — mỗi sticker là một emoji cỡ lớn kèm nhãn tiếng Việt,
 * gửi đi như một loại tin nhắn riêng (`kind = 'sticker'`, `body = sticker.id`).
 */
export const STICKER_PACKS: { id: string; label: string }[] = [
  { id: "cam_xuc", label: "Cảm xúc" },
  { id: "hang_ngay", label: "Hằng ngày" },
];

export const STICKERS: Sticker[] = [
  // Cảm xúc
  { id: "st_ok", emoji: "👌", label: "Ok nha", pack: "cam_xuc" },
  { id: "st_love", emoji: "🥰", label: "Thương quá", pack: "cam_xuc" },
  { id: "st_cry", emoji: "😭", label: "Khóc thét", pack: "cam_xuc" },
  { id: "st_laugh", emoji: "🤣", label: "Cười xỉu", pack: "cam_xuc" },
  { id: "st_angry", emoji: "😤", label: "Giận đó", pack: "cam_xuc" },
  { id: "st_sleepy", emoji: "😴", label: "Buồn ngủ", pack: "cam_xuc" },
  { id: "st_thanks", emoji: "🙏", label: "Cảm ơn", pack: "cam_xuc" },
  { id: "st_clap", emoji: "👏", label: "Giỏi lắm", pack: "cam_xuc" },
  { id: "st_party", emoji: "🥳", label: "Quẩy lên", pack: "cam_xuc" },
  { id: "st_think", emoji: "🤔", label: "Để nghĩ đã", pack: "cam_xuc" },
  { id: "st_hug", emoji: "🤗", label: "Ôm cái", pack: "cam_xuc" },
  { id: "st_wink", emoji: "😉", label: "Hiểu rồi", pack: "cam_xuc" },

  // Hằng ngày
  { id: "st_hi", emoji: "👋", label: "Chào nhé", pack: "hang_ngay" },
  { id: "st_coffee", emoji: "☕", label: "Cà phê không", pack: "hang_ngay" },
  { id: "st_eat", emoji: "🍚", label: "Ăn cơm thôi", pack: "hang_ngay" },
  { id: "st_go", emoji: "🛵", label: "Đi thôi", pack: "hang_ngay" },
  { id: "st_wait", emoji: "⏰", label: "Đợi chút", pack: "hang_ngay" },
  { id: "st_call", emoji: "📞", label: "Gọi mình nhé", pack: "hang_ngay" },
  { id: "st_work", emoji: "💻", label: "Đang bận", pack: "hang_ngay" },
  { id: "st_done", emoji: "✅", label: "Xong rồi", pack: "hang_ngay" },
  { id: "st_money", emoji: "💰", label: "Chuyển khoản", pack: "hang_ngay" },
  { id: "st_home", emoji: "🏠", label: "Về nhà đây", pack: "hang_ngay" },
  { id: "st_sorry", emoji: "🙇", label: "Xin lỗi nha", pack: "hang_ngay" },
  { id: "st_fire", emoji: "🔥", label: "Đỉnh thật", pack: "hang_ngay" },
];

export function findSticker(id?: string): Sticker | undefined {
  if (!id) return undefined;
  return STICKERS.find((s) => s.id === id);
}
