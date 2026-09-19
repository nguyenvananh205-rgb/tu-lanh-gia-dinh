import { useState } from "react";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useIdentity } from "./hooks/useIdentity";
import { useChat } from "./hooks/useChat";
import { avatarColor, avatarOf, displayName } from "./utils/format";
import IdentityGate from "./components/IdentityGate";
import ConversationList from "./components/ConversationList";
import ChatThread from "./components/ChatThread";

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
  const identity = useIdentity();
  const chat = useChat(identity.me);
  const [editingProfile, setEditingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Chưa cấu hình Supabase ────────────────────────────────────
  if (!identity.configured) {
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

  // ── Đang khởi tạo danh tính ───────────────────────────────────
  if (identity.loading) {
    return (
      <CenteredCard>
        <Loader2 size={26} className="animate-spin text-indigo-500 mx-auto" />
        <p className="text-sm text-slate-400 mt-3">Đang chuẩn bị...</p>
      </CenteredCard>
    );
  }

  if (identity.error && !identity.me) {
    return (
      <CenteredCard>
        <h1 className="text-lg font-bold text-slate-800 mb-2">Không kết nối được</h1>
        <p className="text-sm text-red-500">{identity.error}</p>
      </CenteredCard>
    );
  }

  // ── Chưa đặt tên hiển thị ─────────────────────────────────────
  if (!identity.me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50">
        <IdentityGate onSave={identity.saveProfile} error={identity.error} />
      </div>
    );
  }

  const me = identity.me;

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await chat.refresh();
    } finally {
      setRefreshing(false);
    }
  };

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
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setEditingProfile(true)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl hover:bg-slate-100"
              title="Đổi tên / ảnh đại diện"
            >
              <span
                className={`w-8 h-8 rounded-full ${avatarColor(me.id)} text-lg flex items-center justify-center`}
              >
                {avatarOf(me)}
              </span>
              <span className="text-sm font-medium text-slate-700 max-w-[110px] truncate">
                {displayName(me)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Nội dung */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-3">
        <div className="h-[calc(100vh-108px)] min-h-[440px]">
          {/* Mobile: danh sách và khung chat thay phiên nhau */}
          <div className="md:hidden h-full">
            {chat.activeId ? (
              <ChatThread key={chat.activeId} chat={chat} me={me} onBack={chat.closeConversation} />
            ) : (
              <ConversationList chat={chat} me={me} />
            )}
          </div>

          {/* Desktop: hai cột */}
          <div className="hidden md:flex h-full gap-3">
            <div className="w-[300px] flex-shrink-0">
              <ConversationList chat={chat} me={me} />
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
                    Chọn một người ở danh sách bên trái để bắt đầu trò chuyện
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {chat.error && <p className="text-xs text-red-500 mt-2 text-center">{chat.error}</p>}
      </main>

      {editingProfile && (
        <IdentityGate
          initialName={me.displayName}
          initialAvatar={me.avatarEmoji}
          error={identity.error}
          onCancel={() => setEditingProfile(false)}
          onSave={async (name, emoji) => {
            await identity.saveProfile(name, emoji);
            setEditingProfile(false);
          }}
        />
      )}
    </div>
  );
}
