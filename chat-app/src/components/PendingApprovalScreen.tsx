import { useState } from "react";
import { Ban, Clock, LogOut, RefreshCw } from "lucide-react";
import type { ChatUser } from "../types";
import { displayName } from "../utils/format";

interface Props {
  me: ChatUser;
  email?: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
}

/** Tài khoản đã đăng ký nhưng admin chưa duyệt (hoặc đã bị từ chối) */
export default function PendingApprovalScreen({ me, email, onRefresh, onSignOut }: Props) {
  const [checking, setChecking] = useState(false);
  const rejected = me.status === "rejected";

  const check = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center">
        <div
          className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
            rejected ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          {rejected ? (
            <Ban size={26} className="text-red-500" />
          ) : (
            <Clock size={26} className="text-amber-500" />
          )}
        </div>

        <h1 className="text-lg font-bold text-slate-800 mb-2">
          {rejected ? "Tài khoản chưa được cấp quyền" : "Đang chờ duyệt"}
        </h1>
        <p className="text-sm text-slate-500">
          {rejected
            ? "Quản trị viên chưa cho phép tài khoản này dùng app. Hãy liên hệ người đã gửi link cho bạn."
            : "Tài khoản đã tạo xong. Quản trị viên cần duyệt trước khi bạn vào nhắn tin được — thường chỉ mất một lúc."}
        </p>

        <div className="mt-4 bg-slate-50 rounded-2xl px-4 py-3 text-left">
          <p className="text-xs text-slate-400">Tài khoản của bạn</p>
          <p className="text-sm font-medium text-slate-700">
            {me.avatarEmoji} {displayName(me)}
          </p>
          {email && <p className="text-xs text-slate-400 mt-0.5 break-all">{email}</p>}
        </div>

        <button
          onClick={() => void check()}
          disabled={checking}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
          Kiểm tra lại
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
