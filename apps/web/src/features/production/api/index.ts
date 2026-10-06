import api from "@/lib/axios";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BOMItem {
  id: number;
  item_id: number;
  quantity: number;
  item_name?: string;
  item_sku?: string;
  unit_of_measure?: string;
}

export interface BOM {
  id: number;
  bom_id: string;
  bom_name: string;
  fg_item_id: number;
  fg_name?: string;
  fg_uom?: string;
  status: "draft" | "published" | "archived";
  num_rm: number;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
  items: BOMItem[];
}

export interface WorkOrder {
  id: number;
  item_id: number;
  item_name?: string;
  item_sku?: string;
  uom?: string;
  quantity: number;
  buyer_id?: number;
  buyer_name?: string;
  document_number?: string;
  order_type?: string;
  process_number?: string;
  process_stage: "open" | "in_progress" | "completed" | "cancelled";
  delivery_date?: string;
  document_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IssuedItem {
  id: number;
  item_id: number;
  item_name?: string;
  item_sku?: string;
  required_quantity: number;
  issued_quantity: number;
  created_at: string;
}

export interface ProductionProcess {
  id: number;
  reference_number?: string;
  process_number: string;
  stage: "open" | "material_issued" | "in_progress" | "completed" | "cancelled";
  status: "not_started" | "running" | "on_hold" | "completed" | "cancelled";
  bom_id?: number;
  bom_number?: string;
  work_order_id?: number;
  fg_item_id: number;
  fg_name?: string;
  fg_uom?: string;
  process_type: "master" | "child";
  target_quantity: number;
  completed_quantity: number;
  order_delivery_date?: string;
  expected_completion_date?: string;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
  issued_items: IssuedItem[];
  dispatch_ready: boolean;
  linked_sales_order_id?: number | null;
  linked_dispatch_status?: string | null;
}

export interface SubContract {
  id: number;
  process_number: string;
  job_work_number?: string;
  stage: "open" | "in_progress" | "completed" | "cancelled";
  status: "not_started" | "running" | "completed" | "cancelled";
  fg_item_id: number;
  fg_name?: string;
  fg_uom?: string;
  target_quantity: number;
  completed_quantity: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── BOM API ────────────────────────────────────────────────────────────────

export const bomApi = {
  list: async (params?: { skip?: number; limit?: number; status?: string }) => {
    const res = await api.get<{ boms: BOM[]; total: number }>("/production/boms", { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<BOM>(`/production/boms/${id}`);
    return res.data;
  },
  getNextId: async () => {
    const res = await api.get<{ bom_id: string }>("/production/boms/next-id");
    return res.data.bom_id;
  },
  create: async (data: { bom_name: string; fg_item_id: number; status?: string; items?: { item_id: number; quantity: number }[] }) => {
    const res = await api.post<BOM>("/production/boms", data);
    return res.data;
  },
  update: async (id: number, data: Partial<BOM & { items?: { item_id: number; quantity: number }[] }>) => {
    const res = await api.put<BOM>(`/production/boms/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/production/boms/${id}`);
  },
};

// ─── Work Order API ─────────────────────────────────────────────────────────

export const workOrderApi = {
  list: async (params?: { skip?: number; limit?: number; stage?: string }) => {
    const res = await api.get<{ orders: WorkOrder[]; total: number }>("/production/work-orders", { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<WorkOrder>(`/production/work-orders/${id}`);
    return res.data;
  },
  create: async (data: Partial<WorkOrder>) => {
    const res = await api.post<WorkOrder>("/production/work-orders", data);
    return res.data;
  },
  update: async (id: number, data: Partial<WorkOrder>) => {
    const res = await api.put<WorkOrder>(`/production/work-orders/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/production/work-orders/${id}`);
  },
  startProcess: async (id: number) => {
    const res = await api.post<ProductionProcess>(`/production/work-orders/${id}/start`);
    return res.data;
  },
};

// ─── Production Process API ─────────────────────────────────────────────────

export const processApi = {
  list: async (params?: { skip?: number; limit?: number; stage?: string; status?: string; process_type?: string }) => {
    const res = await api.get<{ processes: ProductionProcess[]; total: number }>("/production/processes", { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ProductionProcess>(`/production/processes/${id}`);
    return res.data;
  },
  create: async (data: Partial<ProductionProcess>) => {
    const res = await api.post<ProductionProcess>("/production/processes", data);
    return res.data;
  },
  update: async (id: number, data: Partial<ProductionProcess>) => {
    const res = await api.put<ProductionProcess>(`/production/processes/${id}`, data);
    return res.data;
  },
  issueItems: async (data: { process_id: number; items: { item_id: number; required_quantity: number; issued_quantity: number }[] }) => {
    const res = await api.post<ProductionProcess>("/production/processes/issue-items", data);
    return res.data;
  },
  issueFromBom: async (id: number) => {
    const res = await api.post<ProductionProcess>(`/production/processes/${id}/issue-from-bom`);
    return res.data;
  },
  complete: async (id: number, completed_quantity?: number) => {
    const res = await api.post<ProductionProcess>(`/production/processes/${id}/complete`, { completed_quantity });
    return res.data;
  },
};

// ─── Sub Contract API ───────────────────────────────────────────────────────

export const subContractApi = {
  list: async (params?: { skip?: number; limit?: number; stage?: string; status?: string }) => {
    const res = await api.get<{ sub_contracts: SubContract[]; total: number }>("/production/sub-contracts", { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<SubContract>(`/production/sub-contracts/${id}`);
    return res.data;
  },
  create: async (data: Partial<SubContract>) => {
    const res = await api.post<SubContract>("/production/sub-contracts", data);
    return res.data;
  },
  update: async (id: number, data: Partial<SubContract>) => {
    const res = await api.put<SubContract>(`/production/sub-contracts/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/production/sub-contracts/${id}`);
  },
};
