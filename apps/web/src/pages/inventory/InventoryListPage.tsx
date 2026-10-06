import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Table,
    Button,
    Typography,
    Space,
    Input,
    Select,
    Row,
    Col,
    Card,
    Dropdown,
    Tooltip,
    Checkbox,
} from "antd";
import { message } from '@/lib/antdHelper';
import {
    PlusOutlined,
    MinusOutlined,
    SearchOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,

    ExportOutlined,
    InfoCircleOutlined,
    SettingOutlined,
    FilterOutlined,
    AppstoreOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { inventoryApi, InventoryItem } from "@/features/inventory/api";
import AddItemModal from "@/features/inventory/components/AddItemModal";
import ItemDetailModal from "@/features/inventory/components/ItemDetailModal";
import AdjustStockModal from "@/features/inventory/components/AdjustStockModal";

const { Title, Text } = Typography;
const { Option } = Select;

const ALL_COLUMNS = [
    { key: "sku", label: "Item Id" },
    { key: "name", label: "Item Name" },
    { key: "category", label: "Item Category" },
    { key: "current_stock", label: "Current Stock" },
    { key: "unit_of_measure", label: "Unit" },
    { key: "default_price", label: "Default Price" },
    { key: "regular_buying_price", label: "Regular Buying Price" },
    { key: "wholesale_buying_price", label: "Wholesale Buying Price" },
    { key: "regular_selling_price", label: "Regular Selling Price" },
    { key: "wholesale_selling_price", label: "Wholesale Selling Price" },
    { key: "min_stock_level", label: "Min Stock Level" },
    { key: "max_stock_level", label: "Max Stock Level" },
    { key: "hsn_code", label: "HSN Code" },
    { key: "tax", label: "Tax" },
];

export default function InventoryListPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [adjustStockOpen, setAdjustStockOpen] = useState(false);
    const [stockAdjustItem, setStockAdjustItem] = useState<InventoryItem | null>(null);
    const [productFilter, setProductFilter] = useState<string>("products");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [visibleCols, setVisibleCols] = useState<string[]>(
        ALL_COLUMNS.map((c) => c.key)
    );
    const [searchText, setSearchText] = useState<Record<string, string>>({});
    const [adjustingItemId, setAdjustingItemId] = useState<number | null>(null);
    const [adjustDirection, setAdjustDirection] = useState<"in" | "out" | null>(null);

    const handleQuickAdjust = async (item: InventoryItem, direction: "in" | "out") => {
        setAdjustingItemId(item.id);
        setAdjustDirection(direction);
        try {
            await inventoryApi.addTransaction({
                item_id: item.id,
                transaction_type: direction,
                quantity: 1,
                reference_type: "manual_adjustment",
                notes: `Quick ${direction === "in" ? "increment" : "decrement"} by 1`,
            });
            message.success(
                `Stock ${direction === "in" ? "increased" : "decreased"} by 1 for ${item.name}`
            );
            await fetchItems();
        } catch (error: any) {
            message.error(`Failed to ${direction === "in" ? "increase" : "decrease"} stock`);
        } finally {
            setAdjustingItemId(null);
            setAdjustDirection(null);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await inventoryApi.getAll();
            setItems(data.items);
            // Refresh the selected item so the detail modal shows updated values
            setSelectedItem((prev) => {
                if (!prev) return prev;
                const updated = data.items.find((i) => i.id === prev.id);
                return updated ?? null;
            });
        } catch {
            message.error("Failed to load inventory items");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    /* ── Export to Excel ── */
    const handleExportExcel = () => {
        if (!items.length) {
            message.warning("No items to export");
            return;
        }
        const rows = items.map((i) => ({
            "Item Id": i.sku,
            "Item Name": i.name,
            "Category": i.category
                ? i.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "",
            "Current Stock": i.current_stock,
            "Unit": i.unit_of_measure,
            "Default Price": i.default_price,
            "Regular Buying Price": i.regular_buying_price,
            "Wholesale Buying Price": i.wholesale_buying_price,
            "Regular Selling Price": i.regular_selling_price,
            "Wholesale Selling Price": i.wholesale_selling_price,
            "Min Stock Level": i.min_stock_level,
            "Max Stock Level": i.max_stock_level,
            "HSN Code": i.hsn_code ?? "",
            "Tax (%)": i.tax,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, "inventory_items.xlsx");
        message.success("Exported to Excel");
    };

    // computed summary
    const stockValue = useMemo(
        () =>
            items.reduce(
                (sum, i) => sum + (i.current_stock || 0) * (i.default_price || 0),
                0
            ),
        [items]
    );
    const lowStockCount = useMemo(
        () =>
            items.filter(
                (i) => i.min_stock_level > 0 && i.current_stock < i.min_stock_level
            ).length,
        [items]
    );
    const excessStockCount = useMemo(
        () =>
            items.filter(
                (i) => i.max_stock_level > 0 && i.current_stock > i.max_stock_level
            ).length,
        [items]
    );

    const filteredItems = useMemo(() => {
        let result = [...items];
        // Apply column search filters
        Object.entries(searchText).forEach(([key, text]) => {
            if (text) {
                result = result.filter((item) => {
                    const val = (item as any)[key];
                    return String(val ?? "")
                        .toLowerCase()
                        .includes(text.toLowerCase());
                });
            }
        });
        return result;
    }, [items, searchText]);

    const formatCurrency = (val: number) =>
        `₹${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const renderSortHeader = (title: string, dataKey?: string) => (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    whiteSpace: "nowrap",
                }}
            >
                <span style={{ color: "#595959", fontSize: 13, fontWeight: 600 }}>
                    {title}
                </span>
                <Space orientation="vertical" size={-8} style={{ lineHeight: 1 }}>
                    <ArrowUpOutlined
                        style={{
                            fontSize: 9,
                            color: "#bfbfbf",
                            cursor: "pointer",
                        }}
                    />
                    <ArrowDownOutlined
                        style={{
                            fontSize: 9,
                            color: "#bfbfbf",
                            cursor: "pointer",
                        }}
                    />
                </Space>
            </div>
            {dataKey && (dataKey === "name" || dataKey === "category") && (
                <Input
                    prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                    placeholder="Search"
                    size="small"
                    style={{
                        marginTop: 6,
                        borderRadius: 6,
                        fontSize: 12,
                        width: "100%",
                    }}
                    value={searchText[dataKey] || ""}
                    onChange={(e) =>
                        setSearchText((prev) => ({
                            ...prev,
                            [dataKey]: e.target.value,
                        }))
                    }
                    onClick={(e) => e.stopPropagation()}
                    allowClear
                />
            )}
        </div>
    );

    const columnDefinitions: Record<string, any> = {
        sku: {
            title: renderSortHeader("Item Id"),
            dataIndex: "sku",
            key: "sku",
            width: 110,
            fixed: "left" as const,
            render: (text: string) => (
                <Text style={{ color: "#595959", fontWeight: 500 }}>{text}</Text>
            ),
        },
        name: {
            title: renderSortHeader("Item Name", "name"),
            dataIndex: "name",
            key: "name",
            width: 200,
            render: (text: string, record: InventoryItem) => (
                <Space>
                    <Text
                        style={{ color: "#008b8b", fontWeight: 500, cursor: "pointer" }}
                        onClick={() => {
                            setSelectedItem(record);
                            setDetailOpen(true);
                        }}
                    >
                        {text}
                    </Text>
                    <ExportOutlined
                        style={{ color: "#008b8b", fontSize: 12, cursor: "pointer" }}
                    />
                </Space>
            ),
        },
        category: {
            title: renderSortHeader("Item Category", "category"),
            dataIndex: "category",
            key: "category",
            width: 150,
            render: (val: string | null) =>
                val ? (
                    <Text style={{ color: "#595959" }}>
                        {val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                ) : (
                    <Text style={{ color: "#bfbfbf" }}>-</Text>
                ),
        },
        current_stock: {
            title: renderSortHeader("Current Stock"),
            dataIndex: "current_stock",
            key: "current_stock",
            width: 220,
            render: (val: number, _record: InventoryItem) => {
                const isNeg = val < 0;
                const isAdjusting = adjustingItemId === _record.id;
                return (
                    <Space size={6} align="center">
                        <Tooltip title="Decrease stock by 1">
                            <Button
                                type="text"
                                size="small"
                                icon={<MinusOutlined />}
                                disabled={isAdjusting || val <= 0}
                                loading={isAdjusting && adjustDirection === "out"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAdjust(_record, "out");
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    minWidth: 28,
                                    borderRadius: 6,
                                    border: "1px solid #d9d9d9",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#ff4d4f",
                                    transition: "all 0.2s ease",
                                }}
                            />
                        </Tooltip>
                        <Text
                            style={{
                                fontWeight: 700,
                                fontSize: 15,
                                color: isNeg ? "#ff4d4f" : "#008b8b",
                                minWidth: 36,
                                textAlign: "center",
                                display: "inline-block",
                            }}
                        >
                            {val}
                        </Text>
                        <Tooltip title="Increase stock by 1">
                            <Button
                                type="text"
                                size="small"
                                icon={<PlusOutlined />}
                                disabled={isAdjusting}
                                loading={isAdjusting && adjustDirection === "in"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAdjust(_record, "in");
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    minWidth: 28,
                                    borderRadius: 6,
                                    border: "1px solid #d9d9d9",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#52c41a",
                                    transition: "all 0.2s ease",
                                }}
                            />
                        </Tooltip>
                    </Space>
                );
            },
        },
        unit_of_measure: {
            title: renderSortHeader("Unit"),
            dataIndex: "unit_of_measure",
            key: "unit_of_measure",
            width: 80,
        },
        default_price: {
            title: renderSortHeader("Default Price"),
            dataIndex: "default_price",
            key: "default_price",
            width: 130,
            render: (val: number) => formatCurrency(val),
        },
        regular_buying_price: {
            title: renderSortHeader("Regular Buying Price"),
            dataIndex: "regular_buying_price",
            key: "regular_buying_price",
            width: 160,
            render: (val: number) => formatCurrency(val),
        },
        wholesale_buying_price: {
            title: renderSortHeader("Wholesale Buying Price"),
            dataIndex: "wholesale_buying_price",
            key: "wholesale_buying_price",
            width: 170,
            render: (val: number) => formatCurrency(val),
        },
        regular_selling_price: {
            title: renderSortHeader("Regular Selling Price"),
            dataIndex: "regular_selling_price",
            key: "regular_selling_price",
            width: 160,
            render: (val: number) => formatCurrency(val),
        },
        wholesale_selling_price: {
            title: renderSortHeader("Wholesale Selling Price"),
            dataIndex: "wholesale_selling_price",
            key: "wholesale_selling_price",
            width: 170,
            render: (val: number) => formatCurrency(val),
        },
        min_stock_level: {
            title: renderSortHeader("Min Stock Level"),
            dataIndex: "min_stock_level",
            key: "min_stock_level",
            width: 140,
            render: (val: number) => val || 0,
        },
        max_stock_level: {
            title: renderSortHeader("Max Stock Level"),
            dataIndex: "max_stock_level",
            key: "max_stock_level",
            width: 140,
            render: (val: number) => val || 0,
        },
        hsn_code: {
            title: renderSortHeader("HSN Code"),
            dataIndex: "hsn_code",
            key: "hsn_code",
            width: 120,
            render: (val: string | null) => val || "-",
        },
        tax: {
            title: renderSortHeader("Tax"),
            dataIndex: "tax",
            key: "tax",
            width: 80,
            render: (val: number) => (val ? `${val}%` : "-"),
        },
    };

    const columns = visibleCols
        .map((key) => columnDefinitions[key])
        .filter(Boolean);

    const columnSelectMenu = {
        items: ALL_COLUMNS.map((col) => ({
            key: col.key,
            label: (
                <Checkbox
                    checked={visibleCols.includes(col.key)}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setVisibleCols((prev) => [...prev, col.key]);
                        } else {
                            setVisibleCols((prev) =>
                                prev.filter((k) => k !== col.key)
                            );
                        }
                    }}
                >
                    {col.label}
                </Checkbox>
            ),
        })),
    };

    return (
        <div style={{ padding: "0px 0px 32px 0px", maxWidth: "100%", overflowX: "hidden" }}>
            {/* Page Header */}
            <div className="flex justify-between items-center mb-4">
                <Space align="center">
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#262626" }}>
                        Item Master
                    </Title>
                    <Tooltip title="Manage all your inventory items here">
                        <InfoCircleOutlined style={{ color: "#8c8c8c", fontSize: 16 }} />
                    </Tooltip>
                </Space>
                <Space>
                    <Dropdown
                        menu={{
                            items: [{ key: "export", label: "Export to Excel" }],
                            onClick: ({ key }) => {
                                if (key === "export") handleExportExcel();
                            },
                        }}
                    >
                        <Button icon={<SettingOutlined />} style={{ color: "#52c41a", borderColor: "#52c41a" }}>
                            Actions
                        </Button>
                    </Dropdown>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setAddModalOpen(true)}
                        style={{ background: "#008b8b", borderColor: "#008b8b" }}
                    >
                        Add Single Item
                    </Button>
                </Space>
            </div>

            {/* Summary Cards */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={6}>
                    <Card
                        size="small"
                        style={{
                            borderRadius: 8,
                            border: "1px solid #e8e8e8",
                        }}
                        styles={{ body: { padding: "14px 20px" } }}
                    >
                        <Text style={{ fontSize: 13, color: "#8c8c8c" }}>
                            Stock Value
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#262626" }}>
                            ₹{stockValue.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card
                        size="small"
                        style={{
                            borderRadius: 8,
                            border: "1px solid #e8e8e8",
                        }}
                        styles={{ body: { padding: "14px 20px" } }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <Text style={{ fontSize: 13, color: "#fa8c16" }}>
                                    Low Stock
                                </Text>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: "#262626",
                                    }}
                                >
                                    {lowStockCount}
                                </div>
                            </div>
                            <FilterOutlined
                                style={{ color: "#008b8b", fontSize: 16, cursor: "pointer" }}
                            />
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card
                        size="small"
                        style={{
                            borderRadius: 8,
                            border: "1px solid #e8e8e8",
                        }}
                        styles={{ body: { padding: "14px 20px" } }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <Text style={{ fontSize: 13, color: "#8c8c8c" }}>
                                    Excess Stock
                                </Text>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: "#262626",
                                    }}
                                >
                                    {excessStockCount}
                                </div>
                            </div>
                            <FilterOutlined
                                style={{ color: "#008b8b", fontSize: 16, cursor: "pointer" }}
                            />
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card
                        size="small"
                        style={{
                            borderRadius: 8,
                            border: "1px solid #52c41a",
                            cursor: "pointer",
                        }}
                        styles={{ body: { padding: "14px 20px" } }}
                        onClick={() => navigate("/app/inventory/dashboard")}
                    >
                        <div className="flex items-center justify-center gap-2" style={{ height: 44 }}>
                            <AppstoreOutlined style={{ fontSize: 18, color: "#52c41a" }} />
                            <Text style={{ fontWeight: 600, color: "#52c41a", fontSize: 15 }}>
                                View Inventory Dashboard
                            </Text>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Filters Row */}
            <div
                className="bg-white rounded-lg border border-gray-200"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
            >
                <div style={{ padding: "16px 24px" }}>
                    <Row gutter={24} align="bottom">
                        <Col>
                            <Text
                                style={{
                                    display: "block",
                                    fontSize: 12,
                                    color: "#8c8c8c",
                                    marginBottom: 6,
                                }}
                            >
                                Products/Services
                            </Text>
                            <Select
                                value={productFilter}
                                onChange={setProductFilter}
                                style={{ width: 140 }}
                                size="middle"
                            >
                                <Option value="products">Products</Option>
                                <Option value="services">Services</Option>
                            </Select>
                        </Col>
                        <Col>
                            <Text
                                style={{
                                    display: "block",
                                    fontSize: 12,
                                    color: "#8c8c8c",
                                    marginBottom: 6,
                                }}
                            >
                                Status
                            </Text>
                            <Select
                                value={statusFilter}
                                onChange={setStatusFilter}
                                style={{ width: 120 }}
                                size="middle"
                            >
                                <Option value="all">All</Option>
                                <Option value="low">Low Stock</Option>
                                <Option value="excess">Excess Stock</Option>
                            </Select>
                        </Col>
                        <Col>
                            <Text
                                style={{
                                    display: "block",
                                    fontSize: 12,
                                    color: "#8c8c8c",
                                    marginBottom: 6,
                                }}
                            >
                                Show/Hide Columns
                            </Text>
                            <Dropdown
                                menu={columnSelectMenu}
                                trigger={["click"]}
                            >
                                <Button size="middle">
                                    {visibleCols.length} columns selected
                                </Button>
                            </Dropdown>
                        </Col>
                    </Row>
                </div>

                <div
                    style={{
                        borderTop: "1px solid #f0f0f0",
                    }}
                />

                <Table
                    columns={columns}
                    dataSource={filteredItems}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: "max-content" }}
                    onRow={(record) => ({
                        onClick: () => {
                            setSelectedItem(record);
                            setDetailOpen(true);
                        },
                        style: { cursor: "pointer" },
                    })}
                    pagination={{
                        showSizeChanger: true,
                        pageSizeOptions: ["20", "50", "100"],
                        defaultPageSize: 20,
                        showTotal: (total, range) =>
                            `${range[0]} to ${range[1]} of ${total}`,
                        style: {
                            padding: "16px 24px",
                            margin: 0,
                            borderTop: "1px solid #f0f0f0",
                        },
                    }}
                    size="middle"
                    className="item-master-table"
                />
            </div>

            <AddItemModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={fetchItems}
            />

            <ItemDetailModal
                open={detailOpen}
                item={selectedItem}
                onClose={() => {
                    setDetailOpen(false);
                    setSelectedItem(null);
                }}
                onUpdated={fetchItems}
            />

            <AdjustStockModal
                open={adjustStockOpen}
                item={stockAdjustItem}
                onClose={() => {
                    setAdjustStockOpen(false);
                    setStockAdjustItem(null);
                }}
                onSuccess={fetchItems}
            />

            <style>{`
                .item-master-table .ant-table-thead > tr > th {
                    background: #fff;
                    border-bottom: 1px solid #f0f0f0;
                    padding: 12px 16px;
                }
                .item-master-table .ant-table-tbody > tr > td {
                    padding: 14px 16px;
                    border-bottom: 1px solid #f5f5f5;
                }
                .item-master-table .ant-table-tbody > tr:hover > td {
                    background: #f9fffe !important;
                }
                .item-master-table .ant-table-pagination.ant-pagination {
                    background: #fafafa;
                    border-top: 1px solid #f0f0f0;
                    border-radius: 0 0 8px 8px;
                    margin: 0 !important;
                    padding: 16px 24px !important;
                }
            `}</style>
        </div>
    );
}
