import api from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────

export type DocumentType =
    | "purchase_order"
    | "service_order"
    | "order_confirmation"
    | "service_confirmation"
    | "invoice"
    | "adhoc_invoice";

export interface POItemCreate {
    item_id: number;
    ordered_quantity: number;
    unit_price: number;
}

export interface POItemResponse extends POItemCreate {
    id: number;
    received_quantity: number;
}

export interface PurchaseOrder {
    id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string | null;
    document_type: DocumentType;
    linked_sales_order_id: number | null;
    linked_sales_order_number: string | null;
    billing_location_id: number | null;
    delivery_location_id: number | null;
    status: "draft" | "sent" | "partial" | "completed" | "cancelled";
    payment_status: "pending" | "partial" | "paid";
    invoice_status: "pending" | "complete";
    goods_status: "not_received" | "received";
    order_date: string;
    expected_delivery_date: string | null;
    total_amount: number;
    notes: string | null;
    // Document tab fields
    extra_charges: any[] | null;
    terms_conditions: string | null;
    comments: any[] | null;
    additional_details: any[] | null;
    signature_data: any | null;
    attachments: any[] | null;
    created_at: string;
    updated_at: string;
    items: POItemResponse[];
}

export interface PurchaseOrderCreatePayload {
    po_number: string;
    supplier_id: number;
    document_type?: DocumentType;
    linked_sales_order_id?: number | null;
    status?: string;
    billing_location_id?: number | null;
    delivery_location_id?: number | null;
    expected_delivery_date?: string | null;
    notes?: string | null;
    items: POItemCreate[];
    // Document tab fields
    extra_charges?: any[] | null;
    terms_conditions?: string | null;
    comments?: any[] | null;
    additional_details?: any[] | null;
    signature_data?: any | null;
    attachments?: any[] | null;
}

export interface PurchaseOrderUpdatePayload {
    po_number?: string;
    supplier_id?: number;
    status?: string;
    payment_status?: string;
    invoice_status?: string;
    goods_status?: string;
    document_type?: DocumentType;
    linked_sales_order_id?: number | null;
    billing_location_id?: number | null;
    delivery_location_id?: number | null;
    expected_delivery_date?: string | null;
    notes?: string | null;
    items?: POItemCreate[];
    // Document tab fields
    extra_charges?: any[] | null;
    terms_conditions?: string | null;
    comments?: any[] | null;
    additional_details?: any[] | null;
    signature_data?: any | null;
    attachments?: any[] | null;
}

// ─── GRN / Inward types ──────────────────────────────────────

export interface GRNItemCreate {
    item_id: number;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
}

export interface GRNItemResponse extends GRNItemCreate {
    id: number;
}

export interface GRNCreatePayload {
    po_id: number;
    grn_number: string;
    delivery_date?: string | null;
    notes?: string | null;
    items: GRNItemCreate[];
}

export interface GRN {
    id: number;
    po_id: number;
    grn_number: string;
    receipt_date: string;
    delivery_date: string | null;
    notes: string | null;
    created_at: string;
    items: GRNItemResponse[];
}

// ─── Stats ───────────────────────────────────────────────────

export interface PurchaseStats {
    total_orders: number;
    total_value: number;
    status_counts: Record<string, number>;
    type_counts: Record<string, number>;
    pending_deliveries: number;
    overdue_deliveries: number;
    recent_orders: PurchaseOrder[];
}

// ─── Document Type Labels ────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    purchase_order: "Purchase Order",
    service_order: "Service Order",
    order_confirmation: "Order Confirmation",
    service_confirmation: "Service Confirmation",
    invoice: "Invoice",
    adhoc_invoice: "Adhoc Invoice",
};

// ─── API ─────────────────────────────────────────────────────

export const purchasesApi = {
    // Orders
    getAll: async (params?: {
        document_type?: string;
        status?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }) => {
        const response = await api.get<{ orders: PurchaseOrder[]; total: number }>(
            "/purchases/orders",
            { params }
        );
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<PurchaseOrder>(`/purchases/orders/${id}`);
        return response.data;
    },

    create: async (data: PurchaseOrderCreatePayload) => {
        const response = await api.post<PurchaseOrder>("/purchases/orders", data);
        return response.data;
    },

    update: async (id: number, data: PurchaseOrderUpdatePayload) => {
        const response = await api.put<PurchaseOrder>(`/purchases/orders/${id}`, data);
        return response.data;
    },

    cancel: async (id: number) => {
        const response = await api.post<PurchaseOrder>(`/purchases/orders/${id}/cancel`);
        return response.data;
    },

    // Stats (Dashboard)
    getStats: async () => {
        const response = await api.get<PurchaseStats>("/purchases/orders/stats");
        return response.data;
    },

    // GRN / Inward APIs
    createGRN: async (data: GRNCreatePayload) => {
        const response = await api.post<GRN>("/purchases/grn", data);
        return response.data;
    },

    getGRN: async (id: number) => {
        const response = await api.get<GRN>(`/purchases/grn/${id}`);
        return response.data;
    },

    listGRNsByPO: async (poId: number) => {
        const response = await api.get<GRN[]>(`/purchases/orders/${poId}/grns`);
        return response.data;
    },
};
