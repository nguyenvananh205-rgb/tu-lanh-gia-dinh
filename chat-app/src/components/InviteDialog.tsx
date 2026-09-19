import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  getOrCreateMyInvite,
  inviteUrl,
  regenerateInvite,
  type ChatInvite,
} from "../lib/invites";

interface Props {
  userId: string;
  onClose: () => void;
}

/**
 * Link mời: ai mở link này (và đã đăng nhập) sẽ tự động có một box chat 1-1
 * với chủ link. Link hết hạn sau 7 ngày, có thể tạo link mới để thu hồi link cũ.
 */
export default function InviteDialog({ userId, onClose }: Props) {
  const [invite, setInvite] = useState<ChatInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrCreateMyInvite(userId)
      .then((result) => {
        if (!cancelled) setInvite(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const link = invite ? inviteUrl(invite.token) : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Trình duyệt không cho copy tự động, bạn hãy copy thủ công");
    }
  };

  const regenerate = async () => {
    setWorking(true);
    setError(null);
    try {
      setInvite(await regenerateInvite(userId));
      setCopied(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Link2 size={19} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">Link mời trò chuyện</h2>
              <p className="text-xs text-slate-400">
                Gửi link này cho người bạn muốn nhắn tin
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-3">
              <p className="text-xs text-slate-500 break-all select-all">{link}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => void copy()}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-2xl transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Đã copy link" : "Copy link"}
              </button>
              <button
                onClick={() => void regenerate()}
                disabled={working}
                className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-2xl disabled:opacity-50"
                title="Tạo link mới và thu hồi link cũ"
              >
                <RefreshCw size={16} className={working ? "animate-spin" : ""} />
                Link mới
              </button>
            </div>

            {invite && (
              <p className="text-[11px] text-slate-400 mt-3">
                Hết hạn ngày {format(parseISO(invite.expiresAt), "dd/MM/yyyy")} · đã dùng{" "}
                {invite.uses} lần. Tạo link mới sẽ thu hồi link cũ.
              </p>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="border-t border-slate-100 mt-4 pt-3">
          <p className="text-xs text-slate-500">
            Người nhận mở link, đăng nhập (hoặc đăng ký) là box chat giữa hai người xuất hiện
            ngay. Không ai tìm thấy bạn nếu không có link.
          </p>
        </div>
      </div>
    </div>
  );
}
