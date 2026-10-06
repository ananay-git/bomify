import { useEffect, useState } from "react";
import { Table, Button, Dropdown, Select, Modal } from 'antd';
import { message } from '@/lib/antdHelper';
import { QuestionCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import { getTransactions, Transaction } from "../api/transactions";
import { fetchParties } from "@/features/parties/api/parties";
import type { Party } from "@/features/parties/api/parties";
import AddCompanyForm from "../../../components/layout/AddCompanyForm";

export default function PurchaseOrderListView() {
    const navigate = useNavigate();
    const [data, setData] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Party[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
        null,
    );

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const res = await getTransactions();
            setData(res.transactions);
            setTotal(res.total);
        } catch {
            message.error("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    };

    const loadSuppliers = async () => {
        try {
            setLoadingSuppliers(true);
            const res = await fetchParties("supplier");
            setSuppliers(res.parties);
        } catch (error) {
            message.error("Failed to load suppliers");
        } finally {
            setLoadingSuppliers(false);
        }
    };

    const handleMenuClick: MenuProps["onClick"] = (e) => {
        if (e.key === "1") {
            setIsSupplierModalOpen(true);
            loadSuppliers();
        }
    };

    const createMenu: MenuProps = {
        onClick: handleMenuClick,
        items: [
            { key: "1", label: "Purchase Order" },
            { key: "2", label: "Service Order" },
            { key: "3", label: "Order Confirmation" },
            { key: "4", label: "Service Confirmation" },
            { key: "5", label: "Invoice" },
        ],
    };

    const renderStatus = (status?: string) => {
        if (!status) return "-";
        const isSuccess = status === "Invoice Created" || status === "Received";
        const isError = status === "Not Dispatched";
        let colorClass = "text-gray-600 border-gray-300";

        if (isSuccess)
            colorClass = "text-emerald-600 border-emerald-300 bg-emerald-50/30";
        if (isError) colorClass = "text-red-500 border-red-300 bg-red-50/30";

        return (
            <span
                className={`px-3 py-1 rounded-full border text-xs font-medium ${colorClass}`}
            >
                {status}
            </span>
        );
    };

    const columns = [
        {
            title: "Company Name",
            dataIndex: "company_name",
            key: "company_name",
        },
        {
            title: "Document Number",
            dataIndex: "document_number",
            key: "document_number",
        },
        {
            title: "Transaction Details",
            dataIndex: "transaction_details",
            key: "transaction_details",
        },
        {
            title: "Invoice Status",
            dataIndex: "invoice_status",
            key: "invoice_status",
            render: renderStatus,
        },
        {
            title: "Goods Status",
            dataIndex: "goods_status",
            key: "goods_status",
            render: renderStatus,
        },
        {
            title: "Last Modified",
            dataIndex: "updated_at",
            key: "updated_at",
            render: (date: string) => new Date(date).toLocaleString(),
        },
    ];

    return (
        <div className="p-6 max-w-400 mx-auto w-full bg-gray-50/30 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    Sales & Purchase
                </h1>
                <Dropdown menu={createMenu} trigger={["click"]}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        className="bg-[#2a9d8f] hover:bg-[#21867a] border-none"
                    >
                        Create Document
                    </Button>
                </Dropdown>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table
                    dataSource={data}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ total, pageSize: 10 }}
                />
            </div>

            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    type="primary"
                    shape="round"
                    icon={<QuestionCircleOutlined />}
                    size="large"
                    className="bg-[#2a9d8f] hover:bg-[#21867a] border-none"
                >
                    Get Help
                </Button>
            </div>

            <Modal
                open={isSupplierModalOpen}
                onCancel={() => setIsSupplierModalOpen(false)}
                footer={null}
                width={500}
                centered
                className="rounded-xl overflow-hidden"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#0e3b5e] m-0">
                        Please Add/Select Supplier
                    </h2>
                    <Button
                        className="text-[#2a9d8f] border-[#2a9d8f] font-medium hover:bg-[#2a9d8f] hover:text-white transition-colors"
                        onClick={() => setIsCreateCompanyOpen(true)}
                    >
                        Add New Company
                    </Button>
                </div>
                <div className="mb-2 text-sm text-gray-600 font-medium">
                    Select Supplier
                </div>
                <Select
                    showSearch
                    size="large"
                    className="w-full mb-4"
                    placeholder="Select Supplier"
                    loading={loadingSuppliers}
                    value={selectedSupplierId}
                    onChange={(value) => setSelectedSupplierId(value)}
                    options={suppliers.map((s) => ({
                        label: s.name,
                        value: s.id,
                    }))}
                />
                <Button
                    type="primary"
                    size="large"
                    disabled={!selectedSupplierId}
                    className="w-full bg-[#2a9d8f] hover:bg-[#21867a] border-none mt-2"
                    onClick={() => {
                        const supplier = suppliers.find(s => s.id === selectedSupplierId);
                        setIsSupplierModalOpen(false);
                        navigate(`/app/purchases/create?supplierId=${selectedSupplierId}&supplierName=${encodeURIComponent(supplier?.name || '')}`);
                    }}
                >
                    Continue
                </Button>
            </Modal>

            <Modal
                open={isCreateCompanyOpen}
                onCancel={() => setIsCreateCompanyOpen(false)}
                footer={null}
                width={760}
                centered
                destroyOnHidden
                className="rounded-xl overflow-hidden"
                styles={{ body: { padding: 0 } }}
            >
                <div className="px-8 py-5 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-semibold text-gray-800 m-0">
                        Add New Company
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 mb-0">
                        Enter the details for your new supplier.
                    </p>
                </div>

                <AddCompanyForm
                    initialType="supplier"
                    onCancel={() => setIsCreateCompanyOpen(false)}
                    onSuccess={() => {
                        setIsCreateCompanyOpen(false);
                        loadSuppliers();
                    }}
                />
            </Modal>
        </div>
    );
}
