import { Loader2, MessageSquarePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatUser } from "../../types";
import type { MessagingState } from "../../hooks/useMessaging";
import {
  avatarColor,
  displayName,
  formatConversationTime,
  initialsOf,
  messagePreview,
} from "../../utils/chatFormat";

interface Props {
  chat: MessagingState;
  me: ChatUser;
}

export default function ConversationList({ chat, me }: Props) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();

  const conversations = useMemo(
    () =>
      chat.conversations.filter((c) =>
        keyword ? displayName(c.partner).toLowerCase().includes(keyword) : true
      ),
    [chat.conversations, keyword]
  );

  // Thành viên tủ lạnh chưa có cuộc trò chuyện nào
  const newContacts = useMemo(() => {
    const chatted = new Set(
      chat.conversations.map((c) => c.partner?.id).filter((id): id is string => !!id)
    );
    return chat.members.filter(
      (m) =>
        !chatted.has(m.id) &&
        (keyword ? displayName(m).toLowerCase().includes(keyword) : true)
    );
  }, [chat.conversations, chat.members, keyword]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="p-2.5 border-b border-slate-100">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm người trong nhà..."
            className="w-full bg-slate-50 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chat.conversationsLoading && chat.conversations.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-emerald-500" />
          </div>
        )}

        {conversations.map((conversation) => {
          const active = conversation.id === chat.activeId;
          return (
            <button
              key={conversation.id}
              onClick={() => chat.openConversation(conversation.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                active ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full ${avatarColor(conversation.partner?.id ?? conversation.id)} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0`}
              >
                {initialsOf(conversation.partner)}
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
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {newContacts.length > 0 && (
          <div className="pt-2">
            <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Thành viên tủ lạnh
            </p>
            {newContacts.map((member) => (
              <button
                key={member.id}
                onClick={() => void chat.startDirectChat(member.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <div
                  className={`w-10 h-10 rounded-full ${avatarColor(member.id)} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0`}
                >
                  {initialsOf(member)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {displayName(member)}
                  </p>
                  <p className="text-xs text-slate-400">Bắt đầu trò chuyện</p>
                </div>
                <MessageSquarePlus size={16} className="text-emerald-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!chat.conversationsLoading && conversations.length === 0 && newContacts.length === 0 && (
          <p className="text-center text-sm text-slate-400 px-4 py-10">
            Chưa có ai để nhắn tin. Hãy chia sẻ mã tủ lạnh để mời người nhà cùng tham gia.
          </p>
        )}
      </div>
    </div>
  );
}
