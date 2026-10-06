import api from "@/lib/axios";

// ─── Types ─────────────────────────────────────────────────────

export type OrderStatus =
    | "draft"
    | "quotation_sent"
    | "confirmed"
    | "processing"
    | "shipped"
    | "invoiced"
    | "paid"
    | "cancelled";

export interface SalesOrderItem {
    id: number;
    item_id: number;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    subtotal: number;
    total_price: number;
    // Enriched from inventory
    item_name?: string;
    item_sku?: string;
    item_hsn?: string;
    item_uom?: string;
    available_stock?: number;
}

export interface CustomerInfo {
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

export interface SalesOrder {
    id: number;
    order_number: string;
    customer_id: number;
    status: OrderStatus;
    order_date: string;
    expected_delivery_date: string | null;
    payment_terms: string | null;
    billing_address: Record<string, string> | null;
    shipping_address: Record<string, string> | null;
    total_amount: number;
    tax_amount: number;
    discount_amount: number;
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
    items: SalesOrderItem[];
    customer: CustomerInfo | null;
}

export interface SOItemCreatePayload {
    item_id: number;
    description?: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    tax_rate?: number;
}

export interface SalesOrderCreatePayload {
    customer_id: number;
    expected_delivery_date?: string | null;
    payment_terms?: string | null;
    billing_address?: Record<string, string> | null;
    shipping_address?: Record<string, string> | null;
    notes?: string | null;
    items: SOItemCreatePayload[];
    // Document tab fields
    extra_charges?: any[] | null;
    terms_conditions?: string | null;
    comments?: any[] | null;
    additional_details?: any[] | null;
    signature_data?: any | null;
    attachments?: any[] | null;
}

export interface SalesOrderUpdatePayload {
    customer_id?: number;
    expected_delivery_date?: string | null;
    payment_terms?: string | null;
    billing_address?: Record<string, string> | null;
    shipping_address?: Record<string, string> | null;
    notes?: string | null;
    items?: SOItemCreatePayload[];
    // Document tab fields
    extra_charges?: any[] | null;
    terms_conditions?: string | null;
    comments?: any[] | null;
    additional_details?: any[] | null;
    signature_data?: any | null;
    attachments?: any[] | null;
}

// ─── API Methods ───────────────────────────────────────────────

export const salesApi = {
    getAll: async (params?: {
        skip?: number;
        limit?: number;
        status?: string;
        search?: string;
        date_from?: string;
        date_to?: string;
    }) => {
        const response = await api.get<{ orders: SalesOrder[]; total: number }>(
            "/sales/orders",
            { params }
        );
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<SalesOrder>(`/sales/orders/${id}`);
        return response.data;
    },

    create: async (data: SalesOrderCreatePayload) => {
        const response = await api.post<SalesOrder>("/sales/orders", data);
        return response.data;
    },

    update: async (id: number, data: SalesOrderUpdatePayload) => {
        const response = await api.put<SalesOrder>(`/sales/orders/${id}`, data);
        return response.data;
    },

    confirm: async (id: number) => {
        const response = await api.post<SalesOrder>(`/sales/orders/${id}/confirm`);
        return response.data;
    },

    process: async (id: number) => {
        const response = await api.post<SalesOrder>(`/sales/orders/${id}/process`);
        return response.data;
    },

    ship: async (id: number) => {
        const response = await api.post<SalesOrder>(`/sales/orders/${id}/ship`);
        return response.data;
    },

    invoice: async (id: number) => {
        const response = await api.post<SalesOrder>(`/sales/orders/${id}/invoice`);
        return response.data;
    },

    markPaid: async (id: number) => {
        const response = await api.post<SalesOrder>(`/sales/orders/${id}/pay`);
        return response.data;
    },

    cancel: async (id: number) => {
        const response = await api.delete<SalesOrder>(`/sales/orders/${id}`);
        return response.data;
    },

    getNextNumber: async () => {
        const response = await api.get<{ order_number: string }>("/sales/orders/next-number");
        return response.data.order_number;
    },
};

export interface OrderConfirmationItem {
    id: number;
    item_id: number;
    quantity: number;
    rate: number;
    taxable_amount: number;
    total: number;
}

export interface OrderConfirmation {
    id: number;
    doc_number: string;
    buyer_id: number;
    status: "draft" | "created" | "completed";
    total_amount: number | null;
    doc_date: string;
    delivery_date: string | null;
    notes: string | null;
    created_at: string;
    items?: OrderConfirmationItem[];
}

export interface OrderConfirmationItemCreate {
    item_id: number;
    quantity: number;
    rate: number;
    taxable_amount: number;
    total: number;
}

export interface OrderConfirmationCreatePayload {
    doc_number: string;
    buyer_id: number;
    doc_date?: string | null;
    delivery_date?: string | null;
    status?: "draft" | "created" | "completed";
    notes?: string | null;
    items: OrderConfirmationItemCreate[];
}

export const orderConfirmationApi = {
    getAll: async () => {
        const response = await api.get<{ confirmations: OrderConfirmation[]; total: number }>("/sales/order-confirmations");
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get<OrderConfirmation>(`/sales/order-confirmations/${id}`);
        return response.data;
    },
    create: async (data: OrderConfirmationCreatePayload) => {
        const response = await api.post<OrderConfirmation>("/sales/order-confirmations", data);
        return response.data;
    },
    updateStatus: async (id: number, status: "draft" | "created" | "completed") => {
        const response = await api.patch<OrderConfirmation>(`/sales/order-confirmations/${id}/status`, { status });
        return response.data;
    }
};
