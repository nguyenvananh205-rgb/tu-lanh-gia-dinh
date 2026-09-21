import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, ShieldCheck, Undo2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { AdminUser, UserStatus } from "../types";
import { listUsersForAdmin, setUserStatus } from "../lib/users";
import { avatarColor } from "../utils/format";

interface Props {
  myId: string;
  onClose: () => void;
  /** Báo lại số tài khoản đang chờ để hiện badge ngoài header */
  onPendingCount?: (count: number) => void;
}

const STATUS_LABELS: Record<UserStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đang dùng",
  rejected: "Bị từ chối",
};

const STATUS_STYLES: Record<UserStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

/** Trang quản trị: duyệt / từ chối / thu hồi quyền dùng app */
export default function AdminPanel({ myId, onClose, onPendingCount }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listUsersForAdmin();
      setUsers(list);
      onPendingCount?.(list.filter((u) => u.status === "pending").length);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [onPendingCount]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const change = async (user: AdminUser, status: UserStatus) => {
    setWorking(user.id);
    setError(null);
    try {
      await setUserStatus(user.id, status);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  const renderRow = (user: AdminUser) => (
    <div
      key={user.id}
      className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 last:border-0"
    >
      <div
        className={`w-9 h-9 rounded-full ${avatarColor(user.id)} text-lg flex items-center justify-center flex-shrink-0`}
      >
        {user.avatarEmoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-800 truncate">{user.displayName}</span>
          {user.role === "admin" && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
              admin
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{user.email}</p>
        <p className="text-[10px] text-slate-300">
          Đăng ký {format(parseISO(user.createdAt), "dd/MM/yyyy HH:mm")}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_STYLES[user.status]}`}>
          {STATUS_LABELS[user.status]}
        </span>

        {working === user.id ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : user.id === myId ? null : user.status === "approved" ? (
          <button
            onClick={() => void change(user, "rejected")}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
            title="Thu hồi quyền dùng app"
          >
            <X size={15} />
          </button>
        ) : user.status === "pending" ? (
          <>
            <button
              onClick={() => void change(user, "approved")}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
              title="Duyệt"
            >
              <Check size={15} />
            </button>
            <button
              onClick={() => void change(user, "rejected")}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
              title="Từ chối"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <button
            onClick={() => void change(user, "approved")}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="Cho dùng lại"
          >
            <Undo2 size={15} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={19} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">Duyệt người dùng</h2>
              <p className="text-xs text-slate-400">
                Chỉ người được bạn duyệt mới vào được app
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void load()}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
              title="Tải lại"
            >
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 px-5 pb-2">{error}</p>}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
                    Chờ duyệt ({pending.length})
                  </p>
                  {pending.map(renderRow)}
                </>
              )}

              <p className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Tài khoản khác ({others.length})
              </p>
              {others.map(renderRow)}

              {users.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">Chưa có tài khoản nào</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
