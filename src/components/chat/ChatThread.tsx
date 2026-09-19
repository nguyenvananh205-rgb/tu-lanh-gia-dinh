import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import type { ChatMessage, ChatUser } from "../../types";
import type { MessagingState } from "../../hooks/useMessaging";
import {
  avatarColor,
  displayName,
  formatDayDivider,
  initialsOf,
} from "../../utils/chatFormat";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import MediaViewer from "./MediaViewer";

interface Props {
  chat: MessagingState;
  me: ChatUser;
  onBack: () => void;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

export default function ChatThread({ chat, me, onBack }: Props) {
  const conversation = chat.activeConversation;
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [viewing, setViewing] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef(0);

  const messages = chat.messages;

  // Tự cuộn xuống khi có tin mới (nếu đang ở gần đáy)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const grew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;
    if (!grew) return;

    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 240;
    const lastIsMine = messages[messages.length - 1]?.senderId === me.id;
    if (nearBottom || lastIsMine) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, me.id]);

  // Cuộn xuống đáy khi mở hội thoại (component được gắn lại theo key = id hội thoại)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  const jumpTo = useCallback((messageId: string) => {
    const target = listRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    window.setTimeout(() => setHighlightId(null), 1600);
  }, []);

  const senderOf = useCallback(
    (senderId: string): ChatUser | null =>
      conversation?.members.find((m) => m.id === senderId) ?? null,
    [conversation]
  );

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === me.id) return messages[i].id;
    }
    return null;
  }, [messages, me.id]);

  if (!conversation) return null;

  const partnerName = displayName(conversation.partner);

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border-b border-slate-100">
        <button
          onClick={onBack}
          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg md:hidden"
          title="Quay lại"
        >
          <ArrowLeft size={18} />
        </button>
        <div
          className={`w-9 h-9 rounded-full ${avatarColor(conversation.partner?.id ?? conversation.id)} text-white text-xs font-semibold flex items-center justify-center`}
        >
          {initialsOf(conversation.partner)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{partnerName}</p>
          <p className="text-[11px] text-slate-400">Chat 1-1 · tin nhắn riêng tư</p>
        </div>
      </div>

      {/* Danh sách tin nhắn */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {chat.hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => void chat.loadOlder()}
              disabled={chat.loadingMore}
              className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
            >
              {chat.loadingMore ? "Đang tải..." : "Xem tin nhắn cũ hơn"}
            </button>
          </div>
        )}

        {chat.messagesLoading && messages.length === 0 && (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-emerald-500" />
          </div>
        )}

        {!chat.messagesLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
            <MessageSquare size={30} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              Chưa có tin nhắn nào với {partnerName}.
              <br />
              Gửi lời chào đầu tiên nhé!
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const mine = message.senderId === me.id;

          const showDay =
            !previous ||
            new Date(previous.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString();

          const endsGroup =
            !next ||
            next.senderId !== message.senderId ||
            new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime() >
              GROUP_GAP_MS;

          return (
            <div key={message.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-100">
                    {formatDayDivider(message.createdAt)}
                  </span>
                </div>
              )}
              <div
                className={`rounded-2xl transition-colors ${
                  highlightId === message.id ? "bg-emerald-50" : ""
                }`}
              >
                <MessageBubble
                  message={message}
                  mine={mine}
                  sender={senderOf(message.senderId)}
                  showAvatar={endsGroup}
                  showStatus={message.id === lastMineId}
                  onReply={(m) => {
                    setEditing(null);
                    setReplyTo(m);
                  }}
                  onEdit={(m) => {
                    setReplyTo(null);
                    setEditing(m);
                  }}
                  onRecall={(m) => {
                    if (window.confirm("Thu hồi tin nhắn này với mọi người?")) void chat.recall(m);
                  }}
                  onDeleteForMe={(m) => {
                    if (window.confirm("Xóa tin nhắn này ở phía bạn?")) void chat.deleteForMe(m);
                  }}
                  onRetry={(m) => void chat.retry(m)}
                  onOpenMedia={setViewing}
                  onJumpTo={jumpTo}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Soạn tin — key đổi khi vào/ra chế độ chỉnh sửa để nạp lại nội dung */}
      <MessageComposer
        key={editing?.id ?? "compose"}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSendText={(value) => {
          void chat.sendText(value, { replyTo });
          setReplyTo(null);
        }}
        onSubmitEdit={(value) => {
          if (editing) void chat.editText(editing, value);
          setEditing(null);
        }}
        onSendSticker={(stickerId) => {
          void chat.sendSticker(stickerId, { replyTo });
          setReplyTo(null);
        }}
        onSendGif={(gif) => {
          void chat.sendGif(gif, { replyTo });
          setReplyTo(null);
        }}
        onSendFiles={(files) => {
          void chat.sendFiles(files, { replyTo });
          setReplyTo(null);
        }}
        onSendVoice={(recording) => {
          void chat.sendVoice(recording, { replyTo });
          setReplyTo(null);
        }}
      />

      {viewing && <MediaViewer message={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
