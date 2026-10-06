/**
 * useBrowserAlerts — whether this browser will show pop-up notifications for
 * QuadStack, and a way to ask for permission.
 *
 * Kept separate from useNotifications so a page can show an "enable alerts"
 * prompt without starting a second polling loop. Every copy of the hook stays
 * in sync, so turning alerts on in the bell menu also clears the banner on the
 * dashboard.
 */

import { useCallback, useEffect, useState } from "react";

export type BrowserPermission = "unsupported" | "default" | "granted" | "denied";

const PERMISSION_EVENT = "qs:browser-permission";

export function readPermission(): BrowserPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function useBrowserAlerts() {
  const [permission, setPermission] = useState<BrowserPermission>(readPermission);

  useEffect(() => {
    const sync = () => setPermission(readPermission());
    window.addEventListener(PERMISSION_EVENT, sync);
    return () => window.removeEventListener(PERMISSION_EVENT, sync);
  }, []);

  /** Must be called from a click — browsers ignore permission requests otherwise. */
  const enableBrowserAlerts = useCallback(async () => {
    if (readPermission() === "unsupported") return;
    const result = await Notification.requestPermission();
    window.dispatchEvent(new Event(PERMISSION_EVENT));
    if (result === "granted") {
      new Notification("Browser alerts are on", {
        body: "You'll see a pop-up here when something needs you.",
        tag: "qs-enabled",
      });
    }
  }, []);

  return { permission, enableBrowserAlerts };
}
