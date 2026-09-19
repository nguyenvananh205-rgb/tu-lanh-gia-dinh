import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ChatUser } from "../types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  createFallbackProfile,
  DisplayNameTakenError,
  getMyProfile,
  signIn as dbSignIn,
  signOut as dbSignOut,
  signUp as dbSignUp,
  touchLastSeen,
  updateMyProfile,
} from "../lib/users";

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  /** Hồ sơ của tôi (tên hiển thị + ảnh đại diện) */
  me: ChatUser | null;
  error: string | null;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string, avatarEmoji: string) => Promise<boolean>;
  clearMessages: () => void;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng";
  if (m.includes("email not confirmed")) return "Tài khoản chưa xác nhận email";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Email này đã được đăng ký, hãy đăng nhập";
  }
  if (m.includes("password should be at least")) return "Mật khẩu phải có ít nhất 6 ký tự";
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "Email không hợp lệ";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Bạn thao tác hơi nhanh, thử lại sau ít phút";
  }
  return message;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current?.user) {
      setMe(null);
      return;
    }
    try {
      let profile = await getMyProfile(current.user.id);
      // Hồ sơ do trigger tạo lúc đăng ký; tạo bù nếu vì lý do nào đó chưa có
      profile ??= await createFallbackProfile(current.user.id);
      setMe(profile);
      void touchLastSeen(current.user.id);
    } catch (err) {
      setError(friendlyError((err as Error).message));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    try {
      await dbSignIn(email, password);
    } catch (err) {
      const message = friendlyError((err as Error).message);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    try {
      const result = await dbSignUp(email, password);
      // Khi bật "Confirm email" trong Supabase, tài khoản cần xác nhận trước khi vào
      if (!result.session) {
        setNotice("Tài khoản đã tạo. Hãy kiểm tra email để xác nhận rồi đăng nhập.");
      }
    } catch (err) {
      const message = friendlyError((err as Error).message);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      await dbSignOut();
      setSession(null);
      setMe(null);
    } catch (err) {
      setError(friendlyError((err as Error).message));
    }
  }, []);

  const updateProfile = useCallback(
    async (displayName: string, avatarEmoji: string) => {
      if (!session?.user) return false;
      setError(null);
      try {
        setMe(await updateMyProfile(session.user.id, displayName, avatarEmoji));
        return true;
      } catch (err) {
        setError(
          err instanceof DisplayNameTakenError
            ? err.message
            : friendlyError((err as Error).message)
        );
        return false;
      }
    },
    [session]
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return {
    configured: isSupabaseConfigured,
    loading,
    session,
    me,
    error,
    notice,
    signIn,
    signUp,
    signOut,
    updateProfile,
    clearMessages,
  };
}
