/**
 * useNotifications — keeps the bell menu up to date and pops a browser
 * notification when something new arrives.
 *
 * It asks the server every few seconds (and again whenever the tab is focused).
 * Browser pop-ups need the tab to be open (it can be in the background) and the
 * person to have allowed notifications for this site.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "@/app/store";
import { notificationApi } from "./api";
import type { AppNotification } from "./api";
import { readPermission, useBrowserAlerts } from "./useBrowserAlerts";

const POLL_MS = 10_000;
/** More new items than this at once are folded into a single pop-up. */
const MAX_POPUPS = 3;

/** Fired on `window` whenever new notifications arrive, so open pages can refresh themselves. */
export const NOTIFICATIONS_EVENT = "qs:notifications";

export function useNotifications() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const { permission, enableBrowserAlerts } = useBrowserAlerts();

  // Highest notification id we've already shown a pop-up for (remembered per person,
  // so a page reload doesn't repeat old pop-ups).
  const lastSeenId = useRef<number | null>(null);
  const storageKey = `qs_last_notified_${getUser()?.id ?? "anon"}`;

  const openNotification = useCallback(async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        const res = await notificationApi.markRead(n.id);
        setUnread(res.unread_count);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch {
        /* the link should still work */
      }
    }
    if (n.link) navigateRef.current(n.link);
  }, []);

  const showPopup = useCallback(
    (n: AppNotification) => {
      const popup = new Notification(n.title, { body: n.message, tag: `qs-${n.id}` });
      popup.onclick = () => {
        window.focus();
        popup.close();
        void openNotification(n);
      };
    },
    [openNotification],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await notificationApi.list(30);
      setItems(data.notifications);
      setUnread(data.unread_count);

      const newest = data.notifications.reduce((max, n) => Math.max(max, n.id), 0);

      if (lastSeenId.current === null) {
        // First load in this tab: anything that arrived while the app was closed
        // counts as new; if we've never seen this person before, treat what's there as seen.
        const stored = Number(localStorage.getItem(storageKey));
        lastSeenId.current = Number.isFinite(stored) && stored > 0 ? stored : newest;
      }

      const fresh = data.notifications
        .filter((n) => n.id > (lastSeenId.current ?? 0) && !n.is_read)
        .sort((a, b) => a.id - b.id);

      if (fresh.length > 0) {
        if (readPermission() === "granted") {
          if (fresh.length > MAX_POPUPS) {
            new Notification(`${fresh.length} new notifications`, {
              body: "Open QuadStack to read them.",
              tag: "qs-many",
            });
          } else {
            fresh.forEach(showPopup);
          }
        }
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT));
      }

      if (newest > (lastSeenId.current ?? 0)) {
        lastSeenId.current = newest;
        localStorage.setItem(storageKey, String(newest));
      }
    } catch {
      /* offline, or signed out — try again on the next tick */
    }
  }, [showPopup, storageKey]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* leave things as they are; the next refresh will correct the badge */
    }
  }, []);

  return { items, unread, permission, openNotification, markAllRead, enableBrowserAlerts };
}
