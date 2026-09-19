import { useEffect, useRef, useState } from "react";
import { Check, CornerUpLeft, Image as ImageIcon, Mic, Send, Smile, Trash2, X } from "lucide-react";
import type { ChatMessage, GifResult, Sticker } from "../types";
import { formatDuration, quotePreview } from "../utils/format";
import { useVoiceRecorder, type VoiceRecording } from "../hooks/useVoiceRecorder";
import EmojiStickerPicker from "./EmojiStickerPicker";

interface Props {
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  disabled?: boolean;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSendText: (text: string) => void;
  onSubmitEdit: (text: string) => void;
  onSendSticker: (stickerId: string) => void;
  onSendGif: (gif: GifResult) => void;
  onSendFiles: (files: File[]) => void;
  onSendVoice: (recording: VoiceRecording) => void;
}

export default function MessageComposer({
  replyTo,
  editing,
  disabled,
  onCancelReply,
  onCancelEdit,
  onSendText,
  onSubmitEdit,
  onSendSticker,
  onSendGif,
  onSendFiles,
  onSendVoice,
}: Props) {
  // Ở chế độ chỉnh sửa, ô nhập mở sẵn với nội dung cũ của tin nhắn
  const [text, setText] = useState(editing?.body ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorder = useVoiceRecorder();

  useEffect(() => {
    if (editing || replyTo) textareaRef.current?.focus();
  }, [editing, replyTo]);

  // Ô nhập tự giãn theo nội dung
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (editing) onSubmitEdit(value);
    else onSendText(value);
    setText("");
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onSendFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const finishRecording = async () => {
    const recording = await recorder.stop();
    if (recording) onSendVoice(recording);
  };

  return (
    <div className="relative border-t border-slate-100 bg-white px-2 py-2 sm:px-3">
      {/* Khung trả lời / chỉnh sửa */}
      {(replyTo || editing) && (
        <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-slate-50 rounded-xl border-l-[3px] border-indigo-400">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-indigo-600 flex items-center gap-1">
              {editing ? <Check size={11} /> : <CornerUpLeft size={11} />}
              {editing ? "Đang chỉnh sửa tin nhắn" : "Đang trả lời"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {editing
                ? editing.body
                : replyTo
                  ? quotePreview(replyTo.kind, replyTo.body, !!replyTo.recalledAt)
                  : ""}
            </p>
          </div>
          <button
            onClick={() => {
              if (editing) onCancelEdit();
              else onCancelReply();
              setText("");
            }}
            className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {recorder.recording ? (
        // ── Đang ghi âm ─────────────────────────────────────────
        <div className="flex items-center gap-2">
          <button
            onClick={recorder.cancel}
            className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl"
            title="Huỷ ghi âm"
          >
            <Trash2 size={18} />
          </button>

          <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-2xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <div className="flex-1 flex items-end gap-[2px] h-6">
              {recorder.levels.map((level, index) => (
                <span
                  key={index}
                  className="flex-1 min-w-[2px] bg-indigo-400 rounded-full"
                  style={{ height: `${Math.max(10, level)}%` }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {formatDuration(recorder.elapsedMs)}
            </span>
          </div>

          <button
            onClick={() => void finishRecording()}
            className="p-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl"
            title="Gửi tin nhắn thoại"
          >
            <Send size={18} />
          </button>
        </div>
      ) : (
        // ── Soạn tin bình thường ────────────────────────────────
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={disabled}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-40 ${
              pickerOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100"
            }`}
            title="Emoji, sticker, GIF"
          >
            <Smile size={20} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !!editing}
            className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl disabled:opacity-40"
            title="Gửi ảnh hoặc video"
          >
            <ImageIcon size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape" && editing) onCancelEdit();
            }}
            placeholder={editing ? "Sửa nội dung tin nhắn..." : "Nhắn tin..."}
            className="flex-1 resize-none border border-slate-200 rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
          />

          {text.trim() || editing ? (
            <button
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="p-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-xl transition-colors"
              title={editing ? "Lưu chỉnh sửa" : "Gửi"}
            >
              {editing ? <Check size={20} /> : <Send size={20} />}
            </button>
          ) : (
            <button
              onClick={() => void recorder.start()}
              disabled={disabled || !recorder.supported}
              className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl disabled:opacity-40"
              title={recorder.supported ? "Ghi âm tin nhắn thoại" : "Thiết bị không hỗ trợ ghi âm"}
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      )}

      {recorder.error && <p className="text-xs text-red-500 mt-1 px-2">{recorder.error}</p>}

      {pickerOpen && (
        <EmojiStickerPicker
          onPickEmoji={(emoji) => {
            setText((prev) => prev + emoji);
            textareaRef.current?.focus();
          }}
          onPickSticker={(sticker: Sticker) => {
            onSendSticker(sticker.id);
            setPickerOpen(false);
          }}
          onPickGif={(gif) => {
            onSendGif(gif);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
