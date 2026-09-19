import { useState } from "react";
import { Eye, EyeOff, Loader2, MessageCircle } from "lucide-react";
import type { AuthState } from "../hooks/useAuth";

interface Props {
  auth: AuthState;
  /** Có link mời đang chờ: nhắc người dùng đăng nhập để mở box chat */
  pendingInvite?: boolean;
}

type Tab = "login" | "register" | "forgot";

export default function AuthScreen({ auth, pendingInvite }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setLocalError(null);
    setConfirm("");
    auth.clearMessages();
  };

  const submit = async () => {
    setLocalError(null);

    if (tab === "forgot") {
      if (!email.trim()) return;
      setBusy(true);
      try {
        await auth.requestPasswordReset(email);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) return;

    if (tab === "register") {
      if (password.length < 6) {
        setLocalError("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }
      if (password !== confirm) {
        setLocalError("Mật khẩu nhập lại không khớp");
        return;
      }
    }

    setBusy(true);
    try {
      if (tab === "register") await auth.signUp(email, password);
      else await auth.signIn(email, password);
    } catch {
      // Thông báo lỗi đã nằm trong auth.error
    } finally {
      setBusy(false);
    }
  };

  const error = localError ?? auth.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center mb-3">
            <MessageCircle size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Nhắn tin</h1>
          <p className="text-sm text-slate-400">Chat 1-1 riêng tư</p>
        </div>

        {pendingInvite && (
          <div className="mb-4 bg-indigo-50 text-indigo-700 text-sm rounded-2xl px-4 py-3">
            Bạn đang mở một link mời. Đăng nhập hoặc tạo tài khoản để vào box chat.
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          {/* Tabs */}
          <div className={`flex bg-slate-100 rounded-xl p-1 mb-5 ${tab === "forgot" ? "hidden" : ""}`}>
            {(
              [
                { id: "login", label: "Đăng nhập" },
                { id: "register", label: "Đăng ký" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === item.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "forgot" && (
            <p className="text-sm text-slate-500 mb-4">
              Nhập email đã đăng ký, chúng tôi sẽ gửi link để bạn đặt mật khẩu mới.
            </p>
          )}

          <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
            onKeyDown={(e) => e.key === "Enter" && tab === "forgot" && void submit()}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[15px] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {tab !== "forgot" && (
            <>
              <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="password">
                Mật khẩu
              </label>
              <div className="relative mb-3">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tab === "login" && void submit()}
                  placeholder={tab === "register" ? "Ít nhất 6 ký tự" : "Mật khẩu của bạn"}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {tab === "login" && (
                <button
                  type="button"
                  onClick={() => switchTab("forgot")}
                  className="text-xs text-indigo-600 hover:underline mb-3"
                >
                  Quên mật khẩu?
                </button>
              )}
            </>
          )}

          {tab === "register" && (
            <>
              <label className="text-sm font-medium text-slate-700 block mb-1.5" htmlFor="confirm">
                Nhập lại mật khẩu
              </label>
              <input
                id="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[15px] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </>
          )}

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          {auth.notice && <p className="text-sm text-indigo-600 mb-3">{auth.notice}</p>}

          <button
            onClick={() => void submit()}
            disabled={busy || !email.trim() || (tab !== "forgot" && !password)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {tab === "register"
              ? "Tạo tài khoản"
              : tab === "forgot"
                ? "Gửi link đặt lại mật khẩu"
                : "Đăng nhập"}
          </button>

          {tab === "forgot" && (
            <button
              type="button"
              onClick={() => switchTab("login")}
              className="w-full text-sm text-slate-500 hover:text-slate-700 mt-3"
            >
              ← Quay lại đăng nhập
            </button>
          )}

          {tab === "register" && (
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Hệ thống sẽ tự đặt cho bạn một tên hiển thị không trùng với ai. Bạn đổi lại được
              bất cứ lúc nào sau khi đăng nhập.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
