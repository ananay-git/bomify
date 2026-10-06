import { useEffect, useState, useCallback } from "react";
import { Table, Button, Typography, Tag, Space, Input, Select, Row, Col, message, Tooltip } from "antd";
import { PlusOutlined, FilterOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined, UserOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { salesApi, SalesOrder, OrderStatus } from "@/features/sales/api";

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; border: string; label: string }> = {
    draft:          { color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', label: 'DRAFT' },
    quotation_sent: { color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7', label: 'QUOTATION SENT' },
    confirmed:      { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'CONFIRMED' },
    processing:     { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591', label: 'PROCESSING' },
    shipped:        { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', label: 'SHIPPED' },
    invoiced:       { color: '#13c2c2', bg: '#e6fffb', border: '#87e8de', label: 'INVOICED' },
    paid:           { color: '#389e0d', bg: '#f6ffed', border: '#95de64', label: 'PAID' },
    cancelled:      { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', label: 'CANCELLED' },
};

export default function SalesOrderListPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [searchRowOpen, setSearchRowOpen] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchText, setSearchText] = useState<string>("");
    const [dateRange, setDateRange] = useState<string>("all");

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (statusFilter && statusFilter !== "all") params.status = statusFilter;
            if (searchText) params.search = searchText;

            const data = await salesApi.getAll(params);
            setOrders(data.orders);
            setTotal(data.total);
        } catch (error) {
            console.error(error);
            message.error("Failed to load sales orders");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleExportCSV = () => {
        if (orders.length === 0) { message.info("No orders to export"); return; }

        const headers = ["Order #", "Buyer", "Status", "Total Amount", "Tax", "Date", "Delivery Date"];
        const rows = orders.map(o => [
            o.order_number,
            o.customer?.name || `Buyer #${o.customer_id}`,
            o.status.toUpperCase(),
            o.total_amount?.toFixed(2),
            o.tax_amount?.toFixed(2),
            o.order_date ? new Date(o.order_date).toLocaleDateString() : '',
            o.expected_delivery_date ? new Date(o.expected_delivery_date).toLocaleDateString() : '',
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sales_orders_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success("Exported to CSV!");
    };

    const renderColumnTitle = (title: string, showSearch: boolean = true) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#595959', fontSize: '13px', fontWeight: 600 }}>{title}</span>
                <Space orientation="vertical" size={-8} style={{ marginLeft: 6 }}>
                    <ArrowUpOutlined style={{ fontSize: 9, color: '#bfbfbf', fontWeight: 'bold', cursor: 'pointer' }} />
                    <ArrowDownOutlined style={{ fontSize: 9, color: '#bfbfbf', fontWeight: 'bold', cursor: 'pointer' }} />
                </Space>
            </div>
            {showSearch && searchRowOpen && (
                <Input 
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }}/>} 
                    placeholder="Search" 
                    size="small" 
                    style={{ borderRadius: '6px', fontSize: '12px', fontWeight: 'normal' }} 
                    onClick={(e) => e.stopPropagation()}
                />
            )}
        </div>
    );

    const columns = [
        { 
            title: renderColumnTitle("Order #"), 
            dataIndex: "order_number", 
            key: "order_number",
            render: (text: string, record: SalesOrder) => (
                <a 
                    style={{ color: '#1890ff', fontWeight: 500 }}
                    onClick={() => navigate(`/app/sales/${record.id}`)}
                >
                    {text}
                </a>
            )
        },
        { 
            title: renderColumnTitle("Buyer"), 
            dataIndex: "customer", 
            key: "customer",
            render: (_: unknown, record: SalesOrder) => (
                <Space style={{ color: '#008b8b', fontWeight: 500 }}>
                    <UserOutlined />
                    {record.customer?.name || `Buyer #${record.customer_id}`}
                </Space>
            )
        },
        { 
            title: renderColumnTitle("Status"), 
            dataIndex: "status", 
            key: "status",
            render: (val: OrderStatus) => {
                const cfg = STATUS_CONFIG[val] || STATUS_CONFIG.draft;
                return (
                    <Tag style={{ 
                        borderRadius: '16px', 
                        background: cfg.bg, 
                        border: `1px solid ${cfg.border}`, 
                        color: cfg.color, 
                        padding: '2px 10px',
                        fontWeight: 600,
                        fontSize: '11px',
                    }}>
                        {cfg.label}
                    </Tag>
                );
            }
        },
        { 
            title: renderColumnTitle("Total Amount", false), 
            dataIndex: "total_amount", 
            key: "total_amount", 
            render: (val: number) => (
                <Text strong style={{ color: '#0f766e' }}>
                    ₹{val?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
            )
        },
        { 
            title: renderColumnTitle("Order Date", false), 
            dataIndex: "order_date", 
            key: "order_date",
            render: (text: string) => (
                <Text style={{ color: '#595959' }}>
                    {text ? new Date(text).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </Text>
            )
        },
        { 
            title: renderColumnTitle("Delivery Date", false), 
            dataIndex: "expected_delivery_date", 
            key: "expected_delivery_date",
            render: (text: string) => (
                <Text style={{ color: '#595959' }}>
                    {text ? new Date(text).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </Text>
            )
        },
    ];

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }}>
            <div className="flex justify-between items-center mb-6">
                <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>Sales Orders</Title>
                <Space>
                    <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export</Button>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <Button icon={<ReloadOutlined />} onClick={fetchOrders} />
                    </Tooltip>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/sales/create')}>
                        Create Order
                    </Button>
                </Space>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                {/* Filters Row */}
                <div style={{ marginBottom: '20px' }}>
                    {!moreFiltersOpen ? (
                        <Space size="large" align="center">
                            <div>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Status</Text>
                                <Select 
                                    value={statusFilter} 
                                    style={{ width: 180 }}
                                    onChange={(val) => setStatusFilter(val)}
                                >
                                    <Option value="all">All</Option>
                                    <Option value="draft">Draft</Option>
                                    <Option value="quotation_sent">Quotation Sent</Option>
                                    <Option value="confirmed">Confirmed</Option>
                                    <Option value="processing">Processing</Option>
                                    <Option value="shipped">Shipped</Option>
                                    <Option value="invoiced">Invoiced</Option>
                                    <Option value="paid">Paid</Option>
                                    <Option value="cancelled">Cancelled</Option>
                                </Select>
                            </div>
                            <Button type="link" icon={<FilterOutlined />} onClick={() => setMoreFiltersOpen(true)} style={{ marginTop: '26px', fontWeight: 500 }}>
                                More Filters
                            </Button>
                            <Button type="link" icon={<SearchOutlined />} onClick={() => setSearchRowOpen(!searchRowOpen)} style={{ marginTop: '26px', fontWeight: 500 }}>
                                Search
                            </Button>
                        </Space>
                    ) : (
                        <Row gutter={24} align="bottom">
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Status</Text>
                                <Select 
                                    value={statusFilter} 
                                    style={{ width: 180 }}
                                    onChange={(val) => setStatusFilter(val)}
                                >
                                    <Option value="all">All</Option>
                                    <Option value="draft">Draft</Option>
                                    <Option value="quotation_sent">Quotation Sent</Option>
                                    <Option value="confirmed">Confirmed</Option>
                                    <Option value="processing">Processing</Option>
                                    <Option value="shipped">Shipped</Option>
                                    <Option value="invoiced">Invoiced</Option>
                                    <Option value="paid">Paid</Option>
                                    <Option value="cancelled">Cancelled</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Date Range</Text>
                                <Select value={dateRange} onChange={setDateRange} style={{ width: 160 }}>
                                    <Option value="all">All Time</Option>
                                    <Option value="this_week">This Week</Option>
                                    <Option value="this_month">This Month</Option>
                                    <Option value="this_quarter">This Quarter</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Search</Text>
                                <Input.Search
                                    placeholder="Order # or Buyer name"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onSearch={fetchOrders}
                                    style={{ width: 240 }}
                                    allowClear
                                />
                            </Col>
                            <Col>
                                <Button type="link" icon={<FilterOutlined />} onClick={() => setMoreFiltersOpen(false)} style={{ fontWeight: 500 }}>
                                    Close Filters
                                </Button>
                            </Col>
                        </Row>
                    )}
                </div>

                <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 -24px 0 -24px' }} />

                <Table
                    columns={columns}
                    dataSource={orders}
                    rowKey="id"
                    loading={loading}
                    onRow={(record) => ({
                        style: { cursor: 'pointer' },
                        onClick: () => navigate(`/app/sales/${record.id}`),
                    })}
                    pagination={{
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        defaultPageSize: 10,
                        total: total,
                        showTotal: (total, range) => `${range[0]} to ${range[1]} of ${total}`,
                        style: { padding: '16px 24px', margin: 0, borderTop: '1px solid #f0f0f0' }
                    }}
                    size="middle"
                    className="custom-grid-table"
                />
            </div>

            <style>{`
                .custom-grid-table .ant-table-thead > tr > th { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; }
                .custom-grid-table .ant-table-tbody > tr > td { padding: 16px; }
                .custom-grid-table .ant-table-tbody > tr:hover > td { background: #f8faff !important; }
                .custom-grid-table .ant-table-pagination.ant-pagination { background: #fafafa; border-top: 1px solid #f0f0f0; border-radius: 0 0 8px 8px; margin: 0 !important; padding: 16px 24px !important; }
            `}
            </style>
        </div>
    );
}
