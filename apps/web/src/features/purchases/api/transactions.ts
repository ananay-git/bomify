import api from "@/lib/axios";

export interface Transaction {
    id: number;
    company_name: string;
    document_type: string;
    document_number: string;
    transaction_details?: string;
    invoice_status?: string;
    goods_status?: string;
    created_at: string;
    updated_at: string;
}

export interface TransactionListResponse {
    transactions: Transaction[];
    total: number;
}

export const getTransactions = async (
    documentType?: string,
): Promise<TransactionListResponse> => {
    const response = await api.get("/transactions/", {
        params: {
            document_type: documentType,
        },
    });

    return response.data;
};
