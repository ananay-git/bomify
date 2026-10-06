/**
 * Staff task API.
 *  - taskApi:      owner side — send an order to staff, see what's out, withdraw it.
 *  - staffTaskApi: staff side — the shared task list and "done, ready for dispatch".
 */

import api from "@/lib/axios";

export type TaskStatus = "assigned" | "ready_for_dispatch" | "cancelled";

export interface TaskMaterial {
  item_name?: string | null;
  item_sku?: string | null;
  unit_of_measure?: string | null;
  quantity: number;
}

export interface StaffTask {
  id: number;
  status: TaskStatus;
  process_id: number;
  process_number: string;
  work_order_id?: number | null;
  order_number?: string | null;
  item_name?: string | null;
  item_sku?: string | null;
  uom?: string | null;
  target_quantity: number;
  completed_quantity?: number | null;
  delivery_date?: string | null;
  note?: string | null;
  assigned_by_name?: string | null;
  assigned_at: string;
  completed_by_name?: string | null;
  completed_at?: string | null;
  completion_note?: string | null;
  materials: TaskMaterial[];
}

export interface StaffDashboard {
  todo: StaffTask[];
  done: StaffTask[];
}

// ─── Owner ──────────────────────────────────────────────────────────────────

export const taskApi = {
  assign: async (data: { work_order_id?: number; process_id?: number; note?: string }) => {
    const res = await api.post<{ task: StaffTask; notified_staff: number }>("/tasks/assign", data);
    return res.data;
  },
  list: async (params?: { include_cancelled?: boolean }) => {
    const res = await api.get<{ tasks: StaffTask[]; total: number }>("/tasks/", { params });
    return res.data;
  },
  cancel: async (id: number) => {
    const res = await api.post<StaffTask>(`/tasks/${id}/cancel`);
    return res.data;
  },
};

// ─── Staff ──────────────────────────────────────────────────────────────────

export const staffTaskApi = {
  dashboard: async () => {
    const res = await api.get<StaffDashboard>("/staff/tasks");
    return res.data;
  },
  complete: async (id: number, data: { completed_quantity?: number; note?: string }) => {
    const res = await api.post<StaffTask>(`/staff/tasks/${id}/complete`, data);
    return res.data;
  },
};
