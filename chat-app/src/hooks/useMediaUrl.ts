import { useEffect, useState } from "react";
import type { ChatMessage } from "../types";
import { cachedMediaUrl, directUrl, signedMediaUrl } from "../lib/media";

/**
 * Trả về đường dẫn hiển thị được cho ảnh/video/voice của một tin nhắn:
 * ảnh tạm khi đang gửi và GIF ngoài dùng thẳng, file trong storage riêng tư
 * thì xin signed URL (có cache).
 */
export function useMediaUrl(message: ChatMessage): string | undefined {
  const direct = directUrl(message);
  const path = message.mediaPath;
  const [url, setUrl] = useState<string | undefined>(
    direct ?? (path ? cachedMediaUrl(path) ?? undefined : undefined)
  );

  useEffect(() => {
    if (direct) {
      setUrl(direct);
      return;
    }
    if (!path) {
      setUrl(undefined);
      return;
    }

    const ready = cachedMediaUrl(path);
    if (ready) {
      setUrl(ready);
      return;
    }

    let cancelled = false;
    void signedMediaUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [direct, path]);

  return url;
}
