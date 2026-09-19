import { useEffect } from "react";
import { Download, X } from "lucide-react";
import type { ChatMessage } from "../../types";

interface Props {
  message: ChatMessage;
  onClose: () => void;
}

/** Xem ảnh/video toàn màn hình */
export default function MediaViewer({ message, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!message.mediaUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a
          href={message.mediaUrl}
          target="_blank"
          rel="noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white"
          title="Tải về"
        >
          <Download size={18} />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white"
          title="Đóng"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        {message.kind === "video" ? (
          <video
            src={message.mediaUrl}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-xl"
          />
        ) : (
          <img
            src={message.mediaUrl}
            alt={message.body ?? "Ảnh"}
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
          />
        )}
        {message.body && (
          <p className="text-white/80 text-sm text-center mt-3">{message.body}</p>
        )}
      </div>
    </div>
  );
}
