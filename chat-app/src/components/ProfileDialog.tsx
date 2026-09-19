import { useState } from "react";
import { LogOut, X } from "lucide-react";
import type { ChatUser } from "../types";

const AVATARS = ["🙂", "😎", "🐱", "🐶", "🦊", "🐼", "🐧", "🌻", "⚡", "🍀", "🎧", "🚀"];

interface Props {
  me: ChatUser;
  error?: string | null;
  onClose: () => void;
  /** Trả về true nếu lưu thành công (tên không bị trùng) */
  onSave: (displayName: string, avatarEmoji: string) => Promise<boolean>;
  onSignOut: () => void;
}

/** Đổi tên hiển thị / ảnh đại diện và đăng xuất */
export default function ProfileDialog({ me, error, onClose, onSave, onSignOut }: Props) {
  const [name, setName] = useState(me.displayName);
  const [avatar, setAvatar] = useState(me.avatarEmoji);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const ok = await onSave(name.trim(), avatar);
      if (ok) {
        setSaved(true);
        window.setTimeout(onClose, 600);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Hồ sơ của bạn</h2>
            <p className="text-xs text-slate-400">
              Tên hiển thị là cách người khác nhìn thấy bạn trong box chat
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
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
          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Mỗi người một tên: nếu tên đã có người dùng, bạn cần chọn tên khác.
        </p>

        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        {saved && <p className="text-sm text-indigo-600 mt-2">Đã lưu</p>}

        <button
          onClick={() => void submit()}
          disabled={!name.trim() || saving}
          className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>

        <button
          onClick={onSignOut}
          className="mt-2 w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-2xl transition-colors"
        >
          <LogOut size={16} />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
