import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const AVATARS = ["🙂", "😎", "🐱", "🐶", "🦊", "🐼", "🐧", "🌻", "⚡", "🍀", "🎧", "🚀"];

interface Props {
  initialName?: string;
  initialAvatar?: string;
  /** Có nút đóng khi đang sửa hồ sơ, không có khi mở app lần đầu */
  onCancel?: () => void;
  onSave: (displayName: string, avatarEmoji: string) => Promise<void> | void;
  error?: string | null;
}

/**
 * App không có đăng nhập: người dùng chỉ đặt tên hiển thị và chọn ảnh đại diện.
 * Danh tính được gắn với phiên ẩn danh của thiết bị.
 */
export default function IdentityGate({
  initialName = "",
  initialAvatar = "🙂",
  onCancel,
  onSave,
  error,
}: Props) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(name.trim(), avatar);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                {onCancel ? "Hồ sơ của bạn" : "Chào bạn!"}
              </h1>
              <p className="text-xs text-slate-400">
                {onCancel ? "Đổi tên hoặc ảnh đại diện" : "Đặt tên để bắt đầu nhắn tin"}
              </p>
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          )}
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-1.5">Ảnh đại diện</label>
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setAvatar(emoji)}
              className={`h-10 rounded-xl text-xl transition-colors ${
                avatar === emoji ? "bg-indigo-100 ring-2 ring-indigo-400" : "hover:bg-slate-100"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="display-name">
          Tên hiển thị
        </label>
        <input
          id="display-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="Ví dụ: Vân Anh"
          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={!name.trim() || saving}
          className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {saving ? "Đang lưu..." : onCancel ? "Lưu thay đổi" : "Vào nhắn tin"}
        </button>

        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Danh tính gắn với trình duyệt này, không cần mật khẩu.
        </p>
      </div>
    </div>
  );
}
