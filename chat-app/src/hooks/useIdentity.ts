import { useCallback, useEffect, useState } from "react";
import type { ChatUser } from "../types";
import { isSupabaseConfigured } from "../lib/supabase";
import { ensureSession, getMyProfile, saveMyProfile, touchLastSeen } from "../lib/users";

export interface IdentityState {
  configured: boolean;
  loading: boolean;
  /** Hồ sơ của tôi; null khi chưa đặt tên hiển thị */
  me: ChatUser | null;
  userId: string | null;
  error: string | null;
  saveProfile: (displayName: string, avatarEmoji: string) => Promise<void>;
}

/**
 * Danh tính của người dùng: mỗi thiết bị nhận một phiên ẩn danh của Supabase,
 * người dùng chỉ cần đặt tên hiển thị (không có màn hình đăng nhập).
 */
export function useIdentity(): IdentityState {
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    ensureSession()
      .then(async (id) => {
        if (cancelled) return;
        setUserId(id);
        const profile = await getMyProfile(id);
        if (cancelled) return;
        setMe(profile);
        if (profile) void touchLastSeen(id);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(
            err.message.toLowerCase().includes("anonymous")
              ? "Hãy bật Anonymous sign-ins trong Supabase → Authentication → Providers"
              : err.message
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(
    async (displayName: string, avatarEmoji: string) => {
      if (!userId) return;
      setError(null);
      try {
        setMe(await saveMyProfile(userId, displayName, avatarEmoji));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [userId]
  );

  return { configured: isSupabaseConfigured, loading, me, userId, error, saveProfile };
}
