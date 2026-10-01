import { useEffect, useCallback } from "react";
import type { FoodItem } from "../types";
import { getExpiryStatus, getDaysUntilExpiry } from "../utils";

const NOTIF_LAST_KEY = "notif_last_check";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function useNotifications(foods: FoodItem[]) {
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const checkAndNotify = useCallback(
    async (force = false) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      const lastCheck = parseInt(localStorage.getItem(NOTIF_LAST_KEY) ?? "0");
      const now = Date.now();

      // Only check once per day unless forced
      if (!force && now - lastCheck < ONE_DAY_MS) return;
      localStorage.setItem(NOTIF_LAST_KEY, String(now));

      const expired = foods.filter((f) => getExpiryStatus(f.expiryDate) === "expired");
      const critical = foods.filter((f) => getExpiryStatus(f.expiryDate) === "critical");
      const soon = foods.filter((f) => getExpiryStatus(f.expiryDate) === "soon");

      if (expired.length > 0) {
        new Notification("⚠️ Tủ lạnh: Thực phẩm đã hỏng!", {
          body: expired.map((f) => f.name).join(", ") + " — Cần bỏ đi ngay",
          icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          tag: "fridge-expired",
        });
      }

      if (critical.length > 0) {
        setTimeout(
          () =>
            new Notification("🔔 Tủ lạnh: Hết hạn hôm nay/ngày mai!", {
              body: critical.map((f) => `${f.name} (còn ${getDaysUntilExpiry(f.expiryDate)}n)`).join(", "),
              icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
              tag: "fridge-critical",
            }),
          500,
        );
      }

      if (soon.length > 0 && expired.length === 0 && critical.length === 0) {
        new Notification("📅 Tủ lạnh: Sắp hết hạn", {
          body: soon.map((f) => `${f.name} (còn ${getDaysUntilExpiry(f.expiryDate)} ngày)`).join(", "),
          icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          tag: "fridge-soon",
        });
      }
    },
    [foods],
  );

  // Check on app open
  useEffect(() => {
    checkAndNotify();
  }, [checkAndNotify]);

  return { requestPermission, checkAndNotify };
}
