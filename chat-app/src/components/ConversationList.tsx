import { Link2, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatUser } from "../types";
import type { ChatState } from "../hooks/useChat";
import {
  avatarColor,
  avatarOf,
  displayName,
  formatConversationTime,
  messagePreview,
} from "../utils/format";

interface Props {
  chat: ChatState;
  me: ChatUser;
  /** Mở hộp thoại link mời để tạo box chat mới */
  onInvite: () => void;
}

export default function ConversationList({ chat, me, onInvite }: Props) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();

  const conversations = useMemo(
    () =>
      chat.conversations.filter((c) =>
        keyword ? displayName(c.partner).toLowerCase().includes(keyword) : true
      ),
    [chat.conversations, keyword]
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-2.5 border-b border-slate-100 space-y-2">
        <button
          onClick={onInvite}
          className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          <Link2 size={16} />
          Mở box chat mới bằng link
        </button>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong các box chat..."
            className="w-full bg-slate-50 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chat.conversationsLoading && chat.conversations.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        )}

        {conversations.map((conversation) => {
          const active = conversation.id === chat.activeId;
          return (
            <button
              key={conversation.id}
              onClick={() => chat.openConversation(conversation.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                active ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full ${avatarColor(conversation.partner?.id ?? conversation.id)} text-lg flex items-center justify-center flex-shrink-0`}
              >
                {avatarOf(conversation.partner)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {displayName(conversation.partner)}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {formatConversationTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs truncate ${
                      conversation.unreadCount > 0 ? "text-slate-700 font-medium" : "text-slate-400"
                    }`}
                  >
                    {messagePreview(conversation.lastMessage, me.id)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-indigo-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {!chat.conversationsLoading && conversations.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500 font-medium mb-1">
              {keyword ? "Không tìm thấy box chat nào" : "Chưa có box chat nào"}
            </p>
            {!keyword && (
              <p className="text-xs text-slate-400">
                Gửi link mời cho người bạn muốn nhắn tin. Khi họ mở link, box chat giữa hai người
                sẽ xuất hiện ở đây.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
