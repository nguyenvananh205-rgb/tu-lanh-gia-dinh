import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import type { AuthState } from "../hooks/useAuth";

interface Props {
  auth: AuthState;
}

/** Hiện khi người dùng mở link "đặt lại mật khẩu" trong email */
export default function ResetPasswordScreen({ auth }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setLocalError(null);
    if (password.length < 6) {
      setLocalError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirm) {
      setLocalError("Mật khẩu nhập lại không khớp");
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(password);
    } finally {
      setBusy(false);
    }
  };

  const error = localError ?? auth.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <KeyRound size={19} className="text-indigo-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Đặt mật khẩu mới</h1>
            <p className="text-xs text-slate-400">Nhập mật khẩu mới cho tài khoản của bạn</p>
          </div>
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="new-password">
          Mật khẩu mới
        </label>
        <div className="relative mb-3">
          <input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="new-confirm">
          Nhập lại mật khẩu mới
        </label>
        <input
          id="new-confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[15px] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy || !password || !confirm}
          className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Lưu mật khẩu mới
        </button>

        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Sau khi lưu, bạn vào thẳng app với mật khẩu mới.
        </p>
      </div>
    </div>
  );
}
