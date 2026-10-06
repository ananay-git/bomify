/**
 * Notifications API — the bell menu and browser pop-ups read from here.
 */

import api from "@/lib/axios";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationApi = {
  list: async (limit = 30) => {
    const res = await api.get<{ notifications: AppNotification[]; unread_count: number }>(
      "/notifications/",
      { params: { limit } },
    );
    return res.data;
  },
  markRead: async (id: number) => {
    const res = await api.post<{ unread_count: number }>(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.post<{ unread_count: number }>("/notifications/read-all");
    return res.data;
  },
};
