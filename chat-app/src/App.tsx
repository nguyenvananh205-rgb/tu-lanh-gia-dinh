import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";
import { acceptInvite, captureInviteFromUrl, clearPendingInvite } from "./lib/invites";
import { avatarColor, avatarOf, displayName } from "./utils/format";
import AuthScreen from "./components/AuthScreen";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import ConversationList from "./components/ConversationList";
import ChatThread from "./components/ChatThread";
import InviteDialog from "./components/InviteDialog";
import ProfileDialog from "./components/ProfileDialog";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const chat = useChat(auth.me);

  const [showProfile, setShowProfile] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const handledInvite = useRef<string | null>(null);

  // Bắt ?invite=... ngay khi mở app, giữ lại cho tới khi đăng nhập xong
  useEffect(() => {
    setPendingInvite(captureInviteFromUrl());
  }, []);

  const myId = auth.me?.id;
  const openConversation = chat.openConversation;
  const refreshChat = chat.refresh;

  // Đã đăng nhập + có link mời đang chờ → mở box chat với người mời
  useEffect(() => {
    if (!myId || !pendingInvite || handledInvite.current === pendingInvite) return;
    handledInvite.current = pendingInvite;

    const token = pendingInvite;
    acceptInvite(token)
      .then(async (conversationId) => {
        await refreshChat();
        openConversation(conversationId);
        setInviteMessage("Đã mở box chat từ link mời");
        clearPendingInvite();
        setPendingInvite(null);
      })
      .catch((err: Error) => {
        setInviteMessage(err.message);
        // Lỗi mạng thì giữ lại link mời để lần mở app sau tự thử lại;
        // link hết hạn / bị thu hồi / của chính mình thì bỏ luôn.
        if (/failed to fetch|network|timeout|load failed/i.test(err.message)) {
          handledInvite.current = null;
          return;
        }
        clearPendingInvite();
        setPendingInvite(null);
      });
  }, [myId, pendingInvite, refreshChat, openConversation]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await chat.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, chat]);

  // ── Chưa cấu hình Supabase ────────────────────────────────────
  if (!auth.configured) {
    return (
      <CenteredCard>
        <div className="w-12 h-12 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
          <MessageCircle size={22} className="text-indigo-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-800 mb-2">Cần cấu hình Supabase</h1>
        <p className="text-sm text-slate-500">
          Tạo file <code className="bg-slate-100 px-1 rounded">.env</code> với
          <code className="bg-slate-100 px-1 rounded mx-1">VITE_SUPABASE_URL</code> và
          <code className="bg-slate-100 px-1 rounded mx-1">VITE_SUPABASE_ANON_KEY</code>, chạy
          <code className="bg-slate-100 px-1 rounded mx-1">supabase/schema.sql</code>, rồi mở lại app.
        </p>
      </CenteredCard>
    );
  }

  if (auth.loading) {
    return (
      <CenteredCard>
        <Loader2 size={26} className="animate-spin text-indigo-500 mx-auto" />
        <p className="text-sm text-slate-400 mt-3">Đang tải...</p>
      </CenteredCard>
    );
  }

  // ── Mở link đặt lại mật khẩu từ email ─────────────────────────
  if (auth.recoveryMode) {
    return <ResetPasswordScreen auth={auth} />;
  }

  // ── Chưa đăng nhập ────────────────────────────────────────────
  if (!auth.session) {
    return <AuthScreen auth={auth} pendingInvite={!!pendingInvite} />;
  }

  // Đã có phiên nhưng hồ sơ chưa tải xong
  if (!auth.me) {
    return (
      <CenteredCard>
        <Loader2 size={26} className="animate-spin text-indigo-500 mx-auto" />
        <p className="text-sm text-slate-400 mt-3">Đang chuẩn bị hồ sơ...</p>
        {auth.error && <p className="text-sm text-red-500 mt-2">{auth.error}</p>}
      </CenteredCard>
    );
  }

  const me = auth.me;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center">
              <MessageCircle size={19} className="text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-800">Nhắn tin</h1>
              <p className="text-[11px] text-slate-400">
                {chat.totalUnread > 0 ? `${chat.totalUnread} tin chưa đọc` : "Không có tin mới"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowInvite(true)}
              className="hidden sm:flex items-center gap-1.5 text-sm text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl"
              title="Tạo link mời"
            >
              <Link2 size={16} />
              Link mời
            </button>

            <button
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl hover:bg-slate-100"
              title="Hồ sơ / đăng xuất"
            >
              <span
                className={`w-8 h-8 rounded-full ${avatarColor(me.id)} text-lg flex items-center justify-center`}
              >
                {avatarOf(me)}
              </span>
              <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                {displayName(me)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Thông báo từ link mời */}
      {inviteMessage && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="flex items-start gap-2 bg-indigo-50 text-indigo-700 text-sm rounded-2xl px-4 py-2.5">
            <span className="flex-1">{inviteMessage}</span>
            <button onClick={() => setInviteMessage(null)} className="text-indigo-400">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Nội dung */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-3">
        <div className="h-[calc(100vh-108px)] min-h-[440px]">
          {/* Mobile: danh sách và khung chat thay phiên nhau */}
          <div className="md:hidden h-full">
            {chat.activeId ? (
              <ChatThread key={chat.activeId} chat={chat} me={me} onBack={chat.closeConversation} />
            ) : (
              <ConversationList chat={chat} me={me} onInvite={() => setShowInvite(true)} />
            )}
          </div>

          {/* Desktop: hai cột */}
          <div className="hidden md:flex h-full gap-3">
            <div className="w-[300px] flex-shrink-0">
              <ConversationList chat={chat} me={me} onInvite={() => setShowInvite(true)} />
            </div>
            <div className="flex-1 min-w-0">
              {chat.activeId ? (
                <ChatThread
                  key={chat.activeId}
                  chat={chat}
                  me={me}
                  onBack={chat.closeConversation}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 text-center px-6">
                  <MessageCircle size={30} className="text-slate-300" />
                  <p className="text-sm text-slate-400">
                    Chọn một box chat ở bên trái, hoặc gửi link mời để mở box chat mới
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {chat.error && <p className="text-xs text-red-500 mt-2 text-center">{chat.error}</p>}
      </main>

      {showInvite && <InviteDialog userId={me.id} onClose={() => setShowInvite(false)} />}

      {showProfile && (
        <ProfileDialog
          me={me}
          error={auth.error}
          onClose={() => {
            auth.clearMessages();
            setShowProfile(false);
          }}
          onSave={auth.updateProfile}
          onChangePassword={auth.changePassword}
          onSignOut={() => {
            setShowProfile(false);
            void auth.signOut();
          }}
        />
      )}
    </div>
  );
}
