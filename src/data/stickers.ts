import type { Sticker } from "../types";

/**
 * Sticker dựng sẵn — mỗi sticker là một emoji cỡ lớn kèm nhãn tiếng Việt,
 * nên không cần tải thêm ảnh và vẫn gửi/nhận như một loại tin nhắn riêng.
 * Tin nhắn sticker lưu `body = sticker.id`.
 */
export const STICKER_PACKS: { id: string; label: string }[] = [
  { id: "cam_xuc", label: "Cảm xúc" },
  { id: "bep_nuc", label: "Bếp núc" },
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

  // Bếp núc
  { id: "st_hungry", emoji: "🍜", label: "Đói bụng", pack: "bep_nuc" },
  { id: "st_cooking", emoji: "🍳", label: "Đang nấu", pack: "bep_nuc" },
  { id: "st_market", emoji: "🛒", label: "Đi chợ nhé", pack: "bep_nuc" },
  { id: "st_fridge", emoji: "🧊", label: "Xem tủ lạnh", pack: "bep_nuc" },
  { id: "st_yummy", emoji: "😋", label: "Ngon quá", pack: "bep_nuc" },
  { id: "st_expired", emoji: "⚠️", label: "Sắp hết hạn", pack: "bep_nuc" },
  { id: "st_eat", emoji: "🍚", label: "Ăn cơm thôi", pack: "bep_nuc" },
  { id: "st_wash", emoji: "🧼", label: "Rửa bát đi", pack: "bep_nuc" },
  { id: "st_coffee", emoji: "☕", label: "Cà phê không", pack: "bep_nuc" },
  { id: "st_cake", emoji: "🍰", label: "Có món ngon", pack: "bep_nuc" },
  { id: "st_fire", emoji: "🔥", label: "Cháy rồi", pack: "bep_nuc" },
  { id: "st_done", emoji: "✅", label: "Xong rồi", pack: "bep_nuc" },
];

export function findSticker(id?: string): Sticker | undefined {
  if (!id) return undefined;
  return STICKERS.find((s) => s.id === id);
}
