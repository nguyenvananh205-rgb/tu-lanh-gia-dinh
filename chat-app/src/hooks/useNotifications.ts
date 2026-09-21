import { useCallback, useEffect, useState } from "react";

const PREF_KEY = "notify_enabled";

export interface NotifyOptions {
  title: string;
  body: string;
  /** Gộp các thông báo cùng một box chat */
  tag?: string;
  onClick?: () => void;
}

export interface NotificationsState {
  supported: boolean;
  permission: NotificationPermission;
  /** Người dùng có bật thông báo trong app không (lưu ở máy) */
  enabled: boolean;
  request: () => Promise<void>;
  toggle: () => void;
  notify: (options: NotifyOptions) => void;
}

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Thông báo tin nhắn mới bằng Notification API của trình duyệt.
 * Chỉ hiện khi app đang chạy nhưng người dùng không nhìn vào (tab ẩn/mất focus)
 * hoặc đang ở box chat khác — tránh làm phiền khi họ đang đọc đúng box đó.
 */
export function useNotifications(): NotificationsState {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied"
  );
  const [enabled, setEnabled] = useState(readPref);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch {
      // Trình duyệt chặn localStorage — bỏ qua, chỉ mất việc nhớ lựa chọn
    }
  }, [enabled]);

  const request = useCallback(async () => {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setEnabled(true);
  }, [supported]);

  const toggle = useCallback(() => {
    setEnabled((v) => !v);
  }, []);

  const notify = useCallback(
    ({ title, body, tag, onClick }: NotifyOptions) => {
      if (!supported || !enabled || permission !== "granted") return;
      try {
        const notification = new Notification(title, {
          body,
          tag,
          icon: `${import.meta.env.BASE_URL}favicon.svg`,
        });
        notification.onclick = () => {
          window.focus();
          onClick?.();
          notification.close();
        };
      } catch {
        // Một số trình duyệt (iOS Safari) không cho tạo Notification trực tiếp
      }
    },
    [supported, enabled, permission]
  );

  return { supported, permission, enabled, request, toggle, notify };
}
