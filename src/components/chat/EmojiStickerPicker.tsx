import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { GifResult, Sticker } from "../../types";
import { EMOJI_GROUPS } from "../../data/emoji";
import { STICKERS, STICKER_PACKS } from "../../data/stickers";
import { getGifApiKey, gifFromUrl, saveGifApiKey, searchGifs } from "../../utils/gifSearch";

interface Props {
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (sticker: Sticker) => void;
  onPickGif: (gif: GifResult) => void;
  onClose: () => void;
}

type TabId = "emoji" | "sticker" | "gif";

const TABS: { id: TabId; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "sticker", label: "Sticker" },
  { id: "gif", label: "GIF" },
];

export default function EmojiStickerPicker({ onPickEmoji, onPickSticker, onPickGif, onClose }: Props) {
  const [tab, setTab] = useState<TabId>("emoji");
  const [emojiGroup, setEmojiGroup] = useState(EMOJI_GROUPS[0].id);
  const [stickerPack, setStickerPack] = useState(STICKER_PACKS[0].id);

  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifKeyInput, setGifKeyInput] = useState("");
  const [gifUrlInput, setGifUrlInput] = useState("");
  const hasGifKey = !!getGifApiKey();

  // Tải GIF nổi bật khi mở tab GIF
  useEffect(() => {
    if (tab !== "gif" || !hasGifKey || gifs.length > 0) return;
    setGifLoading(true);
    searchGifs("")
      .then(setGifs)
      .catch((err: Error) => setGifError(err.message))
      .finally(() => setGifLoading(false));
  }, [tab, hasGifKey, gifs.length]);

  const runGifSearch = async () => {
    setGifLoading(true);
    setGifError(null);
    try {
      setGifs(await searchGifs(gifQuery));
    } catch (err) {
      setGifError((err as Error).message);
    } finally {
      setGifLoading(false);
    }
  };

  const emojis = EMOJI_GROUPS.find((g) => g.id === emojiGroup)?.emojis ?? [];
  const stickers = STICKERS.filter((s) => s.pack === stickerPack);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-0 sm:w-[340px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-40">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-100 px-2">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "text-emerald-600 border-emerald-500"
                  : "text-slate-400 border-transparent hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
          <X size={15} />
        </button>
      </div>

      {/* Emoji */}
      {tab === "emoji" && (
        <div>
          <div className="flex gap-1 px-2 pt-2">
            {EMOJI_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setEmojiGroup(g.id)}
                title={g.label}
                className={`w-8 h-8 rounded-lg text-lg ${
                  emojiGroup === g.id ? "bg-emerald-50" : "hover:bg-slate-100"
                }`}
              >
                {g.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onPickEmoji(emoji)}
                className="h-9 text-xl rounded-lg hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticker */}
      {tab === "sticker" && (
        <div>
          <div className="flex gap-1 px-2 pt-2">
            {STICKER_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setStickerPack(pack.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  stickerPack === pack.id
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {pack.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 p-2 max-h-52 overflow-y-auto">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => onPickSticker(sticker)}
                className="flex flex-col items-center gap-0.5 py-2 rounded-xl hover:bg-slate-50"
              >
                <span className="text-3xl leading-none">{sticker.emoji}</span>
                <span className="text-[10px] text-slate-400">{sticker.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GIF */}
      {tab === "gif" && (
        <div className="p-2 space-y-2">
          {hasGifKey ? (
            <>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void runGifSearch()}
                    placeholder="Tìm GIF..."
                    className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <button
                  onClick={() => void runGifSearch()}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm"
                >
                  Tìm
                </button>
              </div>

              {gifError && <p className="text-xs text-red-500">{gifError}</p>}

              {gifLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-emerald-500" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                  {gifs.map((gif) => (
                    <button key={gif.id} onClick={() => onPickGif(gif)} className="rounded-lg overflow-hidden">
                      <img
                        src={gif.previewUrl}
                        alt={gif.description}
                        loading="lazy"
                        className="w-full h-20 object-cover hover:opacity-80"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Thêm Tenor API key để tìm GIF, hoặc dán thẳng link GIF bên dưới.
              </p>
              <div className="flex gap-1.5">
                <input
                  value={gifKeyInput}
                  onChange={(e) => setGifKeyInput(e.target.value)}
                  placeholder="Tenor API key"
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  onClick={() => {
                    if (!gifKeyInput.trim()) return;
                    saveGifApiKey(gifKeyInput);
                    setGifKeyInput("");
                    void runGifSearch();
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm"
                >
                  Lưu
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1.5 border-t border-slate-100 pt-2">
            <input
              value={gifUrlInput}
              onChange={(e) => setGifUrlInput(e.target.value)}
              placeholder="Dán link GIF (https://...)"
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              onClick={() => {
                const gif = gifFromUrl(gifUrlInput);
                if (!gif) {
                  setGifError("Link GIF không hợp lệ");
                  return;
                }
                setGifUrlInput("");
                onPickGif(gif);
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
