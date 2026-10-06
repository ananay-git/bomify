import api from "@/lib/axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: "raw_material" | "finished_good" | "packaging" | null;
  product_service: "product" | "service";
  buy_sell: "buy" | "sell" | "both";
  unit_of_measure: string;
  current_stock: number;
  default_price: number;
  hsn_code: string | null;
  tax: number;
  min_stock_level: number;
  max_stock_level: number;
  reorder_level: number;
  regular_buying_price: number;
  wholesale_buying_price: number;
  regular_selling_price: number;
  wholesale_selling_price: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemCreatePayload {
  sku: string;
  name: string;
  category?: string | null;
  product_service?: string;
  buy_sell?: string;
  unit_of_measure: string;
  current_stock?: number;
  default_price?: number;
  hsn_code?: string;
  tax?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_level?: number;
  regular_buying_price?: number;
  wholesale_buying_price?: number;
  regular_selling_price?: number;
  wholesale_selling_price?: number;
  description?: string;
}

export interface StockLevelSummary {
  negative_stock: number;
  low_stock: number;
  reorder_stock: number;
  optimum_stock: number;
  high_stock: number;
  excess_stock: number;
  total_items: number;
}

export interface TopItemEntry {
  item_id: number;
  item_name: string;
  invoices: number;
  traded_amount: number;
}

export interface StockValuationByCategory {
  category: string;
  value: number;
  count: number;
}

export interface InventoryDashboard {
  stock_valuation_value: number;
  stock_valuation_count: number;
  stock_levels: StockLevelSummary;
  top_selling_items: TopItemEntry[];
  top_purchased_items: TopItemEntry[];
  valuation_by_category: StockValuationByCategory[];
  last_updated: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const inventoryApi = {
  getAll: async (params?: { skip?: number; limit?: number }) => {
    const res = await api.get<{ items: InventoryItem[]; total: number }>("/inventory/items", { params });
    return res.data;
  },

  getById: async (id: number) => {
    const res = await api.get<InventoryItem>(`/inventory/items/${id}`);
    return res.data;
  },

  create: async (data: ItemCreatePayload) => {
    const res = await api.post<InventoryItem>("/inventory/items", data);
    return res.data;
  },

  update: async (id: number, data: Partial<ItemCreatePayload>) => {
    const res = await api.put<InventoryItem>(`/inventory/items/${id}`, data);
    return res.data;
  },

  getNextSku: async () => {
    const res = await api.get<{ sku: string }>("/inventory/items/next-sku");
    return res.data.sku;
  },

  getDashboard: async () => {
    const res = await api.get<InventoryDashboard>("/inventory/dashboard");
    return res.data;
  },

  addTransaction: async (data: {
    item_id: number;
    transaction_type: "in" | "out" | "adjustment";
    quantity: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
  }) => {
    const res = await api.post("/inventory/transactions", data);
    return res.data;
  },
};
