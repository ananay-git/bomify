import api from "@/lib/axios";

// ─── Types ─────────────────────────────────────────────────────

export type DispatchStatus = "draft" | "packed" | "shipped" | "delivered" | "cancelled";

export interface DispatchItem {
    id: number;
    product_id: number;
    quantity: number;
    picked_quantity: number;
    packed_quantity: number;
    // Enriched from inventory
    item_name?: string;
    item_sku?: string;
    item_hsn?: string;
    item_uom?: string;
    available_stock?: number;
}

export interface DispatchCustomerInfo {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
}

export interface DispatchSalesOrderInfo {
    id: number;
    order_number: string;
    status: string;
    customer_id: number;
    total_amount: number | null;
    order_date: string | null;
    expected_delivery_date: string | null;
    customer: DispatchCustomerInfo | null;
}

export interface DispatchRecord {
    id: number;
    dispatch_number: string;
    sales_order_id: number | null;
    production_process_id: number | null;
    status: DispatchStatus;
    logistics_partner: string | null;
    tracking_number: string | null;
    dispatch_date: string | null;
    expected_delivery: string | null;
    delivered_date: string | null;
    vehicle_details: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    items: DispatchItem[];
    sales_order: DispatchSalesOrderInfo | null;
}

export interface DispatchItemCreatePayload {
    product_id: number;
    quantity: number;
    picked_quantity?: number;
    packed_quantity?: number;
}

export interface DispatchCreatePayload {
    sales_order_id?: number | null;
    production_process_id?: number | null;
    dispatch_date?: string | null;
    expected_delivery?: string | null;
    logistics_partner?: string | null;
    vehicle_details?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    notes?: string | null;
    items: DispatchItemCreatePayload[];
}

export interface DispatchUpdatePayload {
    dispatch_date?: string | null;
    expected_delivery?: string | null;
    logistics_partner?: string | null;
    tracking_number?: string | null;
    vehicle_details?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    notes?: string | null;
}

// ─── Dispatchable Sales Order Types ────────────────────────────

export interface DispatchableSalesOrderItem {
    item_id: number;
    item_name: string | null;
    item_sku: string | null;
    item_uom: string | null;
    ordered_quantity: number;
    already_dispatched: number;
    remaining_quantity: number;
    available_stock: number | null;
}

export interface DispatchableSalesOrder {
    id: number;
    order_number: string;
    status: string;
    customer_id: number;
    customer_name: string | null;
    total_amount: number | null;
    order_date: string | null;
    items: DispatchableSalesOrderItem[];
}

export interface ProductionReadyItem {
    process_id: number;
    process_number: string;
    fg_item_id: number;
    fg_name: string;
    fg_sku: string;
    completed_quantity: number;
    available_stock: number;
    linked_sales_order_id: number | null;
    completion_date: string | null;
}

// ─── API Methods ───────────────────────────────────────────────

export const dispatchApi = {
    getAll: async (params?: {
        skip?: number;
        limit?: number;
        status?: string;
        search?: string;
    }) => {
        const response = await api.get<{ dispatches: DispatchRecord[]; total: number }>(
            "/dispatch/dispatches",
            { params }
        );
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<DispatchRecord>(`/dispatch/dispatches/${id}`);
        return response.data;
    },

    create: async (data: DispatchCreatePayload) => {
        const response = await api.post<DispatchRecord>("/dispatch/dispatches", data);
        return response.data;
    },

    update: async (id: number, data: DispatchUpdatePayload) => {
        const response = await api.put<DispatchRecord>(`/dispatch/dispatches/${id}`, data);
        return response.data;
    },

    pack: async (id: number) => {
        const response = await api.post<DispatchRecord>(`/dispatch/dispatches/${id}/pack`);
        return response.data;
    },

    ship: async (id: number, data?: { tracking_number?: string; logistics_partner?: string }) => {
        const response = await api.post<DispatchRecord>(`/dispatch/dispatches/${id}/ship`, data || {});
        return response.data;
    },

    deliver: async (id: number) => {
        const response = await api.post<DispatchRecord>(`/dispatch/dispatches/${id}/deliver`);
        return response.data;
    },

    cancel: async (id: number) => {
        const response = await api.delete<DispatchRecord>(`/dispatch/dispatches/${id}`);
        return response.data;
    },

    getNextNumber: async () => {
        const response = await api.get<{ dispatch_number: string }>("/dispatch/dispatches/next-number");
        return response.data.dispatch_number;
    },

    getDispatchableSalesOrders: async () => {
        const response = await api.get<{ orders: DispatchableSalesOrder[] }>("/dispatch/sales-orders/dispatchable");
        return response.data.orders;
    },

    getProductionReadyItems: async () => {
        const response = await api.get<{ items: ProductionReadyItem[] }>("/dispatch/production-ready");
        return response.data.items;
    },
};
