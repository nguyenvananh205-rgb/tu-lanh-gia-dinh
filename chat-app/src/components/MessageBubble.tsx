import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ChatMessage, ChatUser } from "../types";
import { findSticker } from "../data/stickers";
import {
  avatarColor,
  displayName,
  formatClock,
  avatarOf,
  quotePreview,
  STATUS_LABELS,
} from "../utils/format";
import VoicePlayer from "./VoicePlayer";
import { useMediaUrl } from "../hooks/useMediaUrl";

interface Props {
  message: ChatMessage;
  mine: boolean;
  sender: ChatUser | null;
  showAvatar: boolean;
  showStatus: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onRecall: (message: ChatMessage) => void;
  onDeleteForMe: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onOpenMedia: (message: ChatMessage) => void;
  onJumpTo: (messageId: string) => void;
}

const EMOJI_ONLY = /^(?:\s*\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*\s*){1,3}$/u;

export default function MessageBubble({
  message,
  mine,
  sender,
  showAvatar,
  showStatus,
  onReply,
  onEdit,
  onRecall,
  onDeleteForMe,
  onRetry,
  onOpenMedia,
  onJumpTo,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Bucket riêng tư: ảnh/video/voice mở bằng link tạm có hạn
  const mediaUrl = useMediaUrl(message);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const recalled = !!message.recalledAt;
  const sticker = message.kind === "sticker" ? findSticker(message.body) : undefined;
  const bare =
    !recalled &&
    (message.kind === "sticker" ||
      message.kind === "gif" ||
      (message.kind === "text" && !!message.body && EMOJI_ONLY.test(message.body)));

  const bubbleClass = bare
    ? ""
    : mine
      ? "bg-indigo-500 text-white rounded-2xl rounded-br-md"
      : "bg-white text-slate-700 rounded-2xl rounded-bl-md border border-slate-100 shadow-sm";

  const renderContent = () => {
    if (recalled) {
      return (
        <span className={`italic text-sm ${mine ? "text-white/80" : "text-slate-400"}`}>
          Tin nhắn đã được thu hồi
        </span>
      );
    }

    // Ảnh/video/voice luôn kèm đường dẫn; nếu thiếu thì báo thay vì hiện ô trống
    if (
      message.kind !== "text" &&
      message.kind !== "sticker" &&
      !message.mediaUrl &&
      !message.mediaPath
    ) {
      return (
        <span className={`text-sm italic ${mine ? "text-white/80" : "text-slate-400"}`}>
          Không tải được nội dung
        </span>
      );
    }

    switch (message.kind) {
      case "sticker":
        return (
          <div className="flex flex-col items-center">
            <span className="text-6xl leading-none">{sticker?.emoji ?? "🙂"}</span>
            {sticker && <span className="text-[11px] text-slate-400 mt-1">{sticker.label}</span>}
          </div>
        );

      case "gif":
        return mediaUrl ? (
          <img
            src={mediaUrl}
            alt={message.body ?? "GIF"}
            loading="lazy"
            className="rounded-2xl max-w-[220px] max-h-[220px] object-cover cursor-pointer"
            onClick={() => onOpenMedia(message)}
          />
        ) : null;

      case "image":
        return (
          <div className="space-y-1">
            <img
              src={mediaUrl}
              alt={message.body ?? "Ảnh"}
              loading="lazy"
              className={`rounded-xl max-w-[240px] max-h-[280px] object-cover cursor-pointer ${
                message.pending ? "opacity-60" : ""
              }`}
              onClick={() => onOpenMedia(message)}
            />
            {message.body && <p className="text-sm">{message.body}</p>}
          </div>
        );

      case "video":
        return (
          <div className="space-y-1">
            <video
              src={mediaUrl}
              controls
              preload="metadata"
              className={`rounded-xl max-w-[240px] max-h-[280px] ${message.pending ? "opacity-60" : ""}`}
            />
            {message.body && <p className="text-sm">{message.body}</p>}
          </div>
        );

      case "voice":
        return mediaUrl ? (
          <VoicePlayer
            src={mediaUrl}
            durationMs={message.durationMs}
            waveform={message.waveform}
            mine={mine}
          />
        ) : null;

      default:
        return (
          <p className={`whitespace-pre-wrap break-words ${bare ? "text-5xl leading-tight" : "text-[15px]"}`}>
            {message.body}
          </p>
        );
    }
  };

  const canEdit = mine && !recalled && message.kind === "text" && !message.pending;
  const canRecall = mine && !recalled && !message.pending;

  return (
    <div
      data-message-id={message.id}
      className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar người gửi (chỉ hiện ở tin cuối của nhóm) */}
      {!mine && (
        <div className="w-7 flex-shrink-0">
          {showAvatar && (
            <div
              className={`w-7 h-7 rounded-full ${avatarColor(message.senderId)} text-sm flex items-center justify-center`}
              title={displayName(sender)}
            >
              {avatarOf(sender)}
            </div>
          )}
        </div>
      )}

      <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
        {/* Khung trả lời (quote) */}
        {message.replyTo && !recalled && (
          <button
            onClick={() => message.replyTo && onJumpTo(message.replyTo.id)}
            className={`text-left text-xs px-3 py-1.5 mb-1 rounded-xl border-l-[3px] max-w-full truncate ${
              mine
                ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                : "bg-slate-100 border-slate-300 text-slate-500"
            }`}
          >
            <span className="font-medium">
              {message.replyTo.senderId === message.senderId ? "Trả lời chính mình" : "Trả lời"}
            </span>
            {" · "}
            {quotePreview(message.replyTo.kind, message.replyTo.body, message.replyTo.recalled)}
          </button>
        )}

        <div className="flex items-end gap-1">
          {/* Menu hành động */}
          <div className={`relative ${mine ? "order-first" : "order-last"}`} ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              title="Tùy chọn"
            >
              <MoreVertical size={15} />
            </button>

            {menuOpen && (
              <div
                className={`absolute bottom-8 z-30 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 text-sm ${
                  mine ? "right-0" : "left-0"
                }`}
              >
                {!recalled && (
                  <button
                    onClick={() => { setMenuOpen(false); onReply(message); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600"
                  >
                    <CornerUpLeft size={14} /> Trả lời
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(message); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600"
                  >
                    <Pencil size={14} /> Chỉnh sửa
                  </button>
                )}
                {canRecall && (
                  <button
                    onClick={() => { setMenuOpen(false); onRecall(message); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-amber-600"
                  >
                    <Undo2 size={14} /> Thu hồi với mọi người
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onDeleteForMe(message); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-red-500"
                >
                  <Trash2 size={14} /> Xóa ở phía tôi
                </button>
              </div>
            )}
          </div>

          <div className={`px-3 py-2 ${bubbleClass} ${bare ? "p-0" : ""}`}>{renderContent()}</div>
        </div>

        {/* Giờ gửi + trạng thái */}
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-slate-400">{formatClock(message.createdAt)}</span>
          {message.editedAt && !recalled && (
            <span className="text-[10px] text-slate-400">· đã sửa</span>
          )}
          {mine && (
            <span className="flex items-center gap-1">
              <span className={message.status === "failed" ? "text-red-500" : "text-slate-400"}>
                {message.status === "failed" ? (
                  <AlertCircle size={12} />
                ) : message.status === "sending" ? (
                  <Clock size={12} />
                ) : message.status === "seen" ? (
                  <CheckCheck size={12} className="text-sky-500" />
                ) : message.status === "delivered" ? (
                  <CheckCheck size={12} />
                ) : (
                  <Check size={12} />
                )}
              </span>
              {showStatus && (
                <span
                  className={`text-[10px] ${
                    message.status === "failed" ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {STATUS_LABELS[message.status]}
                </span>
              )}
            </span>
          )}
          {message.status === "failed" && (
            <button
              onClick={() => onRetry(message)}
              className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline"
            >
              <RotateCcw size={11} /> Gửi lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
