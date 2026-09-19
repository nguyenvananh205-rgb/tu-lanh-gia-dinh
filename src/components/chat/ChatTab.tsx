import { MessageCircle, UserPlus } from "lucide-react";
import type { ChatUser } from "../../types";
import type { MessagingState } from "../../hooks/useMessaging";
import ConversationList from "./ConversationList";
import ChatThread from "./ChatThread";

interface Props {
  chat: MessagingState;
  me: ChatUser | null;
  /** Người dùng vãng lai (chưa có tài khoản) */
  isGuest: boolean;
  onShowRegister?: () => void;
  onShare?: () => void;
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
      <div className="w-12 h-12 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
        <MessageCircle size={22} className="text-emerald-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          <UserPlus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function ChatTab({ chat, me, isGuest, onShowRegister, onShare }: Props) {
  if (isGuest || !me) {
    return (
      <EmptyState
        title="Nhắn tin cần tài khoản"
        description="Tạo tài khoản để nhắn tin riêng với người nhà: gửi ảnh, video, tin nhắn thoại, sticker và xem trạng thái đã xem."
        actionLabel="Tạo tài khoản"
        onAction={onShowRegister}
      />
    );
  }

  if (!chat.enabled) {
    return (
      <EmptyState
        title="Chưa bật đồng bộ"
        description="Chức năng nhắn tin cần kết nối Supabase. Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY rồi chạy supabase/messaging-schema.sql."
      />
    );
  }

  const hasSomeone = chat.conversations.length > 0 || chat.members.length > 0;
  if (!hasSomeone && !chat.conversationsLoading) {
    return (
      <EmptyState
        title="Chưa có ai trong tủ lạnh"
        description="Mời người nhà bằng mã chia sẻ tủ lạnh, sau đó bạn có thể nhắn tin 1-1 với họ ngay tại đây."
        actionLabel={onShare ? "Chia sẻ tủ lạnh" : undefined}
        onAction={onShare}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-250px)] min-h-[440px]">
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
        <div className="w-[290px] flex-shrink-0">
          <ConversationList chat={chat} me={me} />
        </div>
        <div className="flex-1 min-w-0">
          {chat.activeId ? (
            <ChatThread key={chat.activeId} chat={chat} me={me} onBack={chat.closeConversation} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 text-center px-6">
              <MessageCircle size={30} className="text-slate-300" />
              <p className="text-sm text-slate-400">
                Chọn một người trong danh sách để bắt đầu trò chuyện
              </p>
            </div>
          )}
        </div>
      </div>

      {chat.error && (
        <p className="text-xs text-red-500 mt-2 text-center">{chat.error}</p>
      )}
    </div>
  );
}
