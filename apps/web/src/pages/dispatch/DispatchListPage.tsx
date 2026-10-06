import { useEffect, useState, useCallback } from "react";
import { Table, Button, Typography, Tag, Space, Input, Select, Row, Col, message, Tooltip } from "antd";
import { PlusOutlined, FilterOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined, UserOutlined, DownloadOutlined, ReloadOutlined, TruckOutlined, CheckCircleOutlined, ClockCircleOutlined, InboxOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { dispatchApi, DispatchRecord, DispatchStatus, ProductionReadyItem } from "@/features/dispatch/api";

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_CONFIG: Record<DispatchStatus, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
    draft:     { color: '#8c8c8c', bg: '#fafafa',  border: '#d9d9d9', label: 'DRAFT',     icon: <ClockCircleOutlined /> },
    packed:    { color: '#fa8c16', bg: '#fff7e6',  border: '#ffd591', label: 'PACKED',    icon: <InboxOutlined /> },
    shipped:   { color: '#1677ff', bg: '#e6f4ff',  border: '#91caff', label: 'SHIPPED',   icon: <TruckOutlined /> },
    delivered: { color: '#52c41a', bg: '#f6ffed',  border: '#b7eb8f', label: 'DELIVERED', icon: <CheckCircleOutlined /> },
    cancelled: { color: '#ff4d4f', bg: '#fff2f0',  border: '#ffccc7', label: 'CANCELLED', icon: <CloseCircleOutlined /> },
};

export default function DispatchListPage() {
    const navigate = useNavigate();
    const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [searchRowOpen, setSearchRowOpen] = useState(false);
    const [productionReady, setProductionReady] = useState<ProductionReadyItem[]>([]);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchText, setSearchText] = useState<string>("");

    const fetchDispatches = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (statusFilter && statusFilter !== "all") params.status = statusFilter;
            if (searchText) params.search = searchText;

            const data = await dispatchApi.getAll(params);
            setDispatches(data.dispatches);
            setTotal(data.total);
        } catch (error) {
            console.error(error);
            message.error("Failed to load dispatches");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText]);

    useEffect(() => {
        fetchDispatches();
        
        // Fetch production ready items silently 
        dispatchApi.getProductionReadyItems()
            .then(data => setProductionReady(data))
            .catch(() => { /* silent */ });

    }, [fetchDispatches]);

    const handleExportCSV = () => {
        if (dispatches.length === 0) { message.info("No dispatches to export"); return; }

        const headers = ["Dispatch #", "Sales Order", "Customer", "Status", "Logistics", "Dispatch Date", "Expected Delivery"];
        const rows = dispatches.map(d => [
            d.dispatch_number,
            d.sales_order?.order_number || `SO #${d.sales_order_id}`,
            d.sales_order?.customer?.name || '',
            d.status.toUpperCase(),
            d.logistics_partner || '',
            d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : '',
            d.expected_delivery ? new Date(d.expected_delivery).toLocaleDateString() : '',
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dispatches_${new Date().toISOString().split("T")[0]}.csv`;
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
            title: renderColumnTitle("Dispatch #"), 
            dataIndex: "dispatch_number", 
            key: "dispatch_number",
            render: (text: string, record: DispatchRecord) => (
                <a 
                    style={{ color: '#1890ff', fontWeight: 500 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/dispatch/${record.id}`); }}
                >
                    {text}
                </a>
            )
        },
        { 
            title: renderColumnTitle("Sales Order"), 
            key: "sales_order",
            render: (_: unknown, record: DispatchRecord) => (
                <a 
                    style={{ color: '#13c2c2', fontWeight: 500 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/sales/${record.sales_order_id}`); }}
                >
                    {record.sales_order?.order_number || `SO #${record.sales_order_id}`}
                </a>
            )
        },
        { 
            title: renderColumnTitle("Customer"), 
            key: "customer",
            render: (_: unknown, record: DispatchRecord) => (
                <Space style={{ color: '#008b8b', fontWeight: 500 }}>
                    <UserOutlined />
                    {record.sales_order?.customer?.name || `Customer #${record.sales_order?.customer_id || ''}`}
                </Space>
            )
        },
        { 
            title: renderColumnTitle("Status"), 
            dataIndex: "status", 
            key: "status",
            render: (val: DispatchStatus, record: DispatchRecord) => {
                const isPaid = record.sales_order?.status === 'paid';
                const effectiveStatus = isPaid ? 'delivered' : val;
                const normalizedVal = effectiveStatus ? String(effectiveStatus).toLowerCase() as DispatchStatus : 'draft';
                const cfg = STATUS_CONFIG[normalizedVal] || STATUS_CONFIG.draft;
                return (
                    <Tag 
                        icon={cfg.icon}
                        style={{ 
                            borderRadius: '16px', 
                            background: cfg.bg, 
                            border: `1px solid ${cfg.border}`, 
                            color: cfg.color, 
                            padding: '2px 10px',
                            fontWeight: 600,
                            fontSize: '11px',
                        }}
                    >
                        {cfg.label}
                    </Tag>
                );
            }
        },
        { 
            title: renderColumnTitle("Logistics"), 
            key: "logistics", 
            render: (_: unknown, record: DispatchRecord) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{record.logistics_partner || "N/A"}</Text>
                    {record.tracking_number && (
                        <Text type="secondary" style={{ fontSize: 11 }}>#{record.tracking_number}</Text>
                    )}
                </Space>
            ) 
        },
        { 
            title: renderColumnTitle("Dispatch Date", false), 
            dataIndex: "dispatch_date", 
            key: "dispatch_date",
            render: (text: string) => (
                <Text style={{ color: '#595959' }}>
                    {text ? new Date(text).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </Text>
            )
        },
        { 
            title: renderColumnTitle("Expected Delivery", false), 
            dataIndex: "expected_delivery", 
            key: "expected_delivery",
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
                <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>Dispatch & Delivery</Title>
                <Space>
                    <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export</Button>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <Button icon={<ReloadOutlined />} onClick={fetchDispatches} />
                    </Tooltip>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/dispatch/create')}>
                        New Dispatch
                    </Button>
                </Space>
            </div>
            
            {productionReady.length > 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <TruckOutlined style={{ color: '#2563eb', fontSize: '18px' }} />
                        <Title level={4} style={{ margin: 0, color: '#1d4ed8' }}>Ready from Production</Title>
                        <Tag color="blue" style={{ borderRadius: '12px', fontWeight: 600 }}>{productionReady.length}</Tag>
                    </div>
                    <Text style={{ display: 'block', color: '#1e40af', marginBottom: '16px' }}>
                        Finished goods from completed production processes are ready for dispatch.
                    </Text>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {productionReady.map((item) => (
                            <div key={item.process_id} style={{ background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #dbeafe', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <Text strong style={{ color: '#1f2937', fontSize: '14px' }}>{item.fg_name}</Text>
                                    <Tag color="green" style={{ margin: 0 }}>Stock: {item.available_stock}</Tag>
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div>SKU: {item.fg_sku || 'N/A'}</div>
                                    <div>Produced: <span style={{ fontWeight: 500, color: '#374151' }}>{item.completed_quantity}</span></div>
                                    <div>Process: {item.process_number}</div>
                                </div>
                                <Button 
                                    type="primary" 
                                    size="small" 
                                    style={{ width: '100%', background: '#2563eb', borderColor: '#2563eb' }}
                                    onClick={() => navigate(item.linked_sales_order_id ? `/app/dispatch/create?so_id=${item.linked_sales_order_id}` : `/app/dispatch/create?process_id=${item.process_id}`)}
                                    icon={<PlusOutlined />}
                                >
                                    Create Dispatch
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                    <Option value="packed">Packed</Option>
                                    <Option value="shipped">Shipped</Option>
                                    <Option value="delivered">Delivered</Option>
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
                                    <Option value="packed">Packed</Option>
                                    <Option value="shipped">Shipped</Option>
                                    <Option value="delivered">Delivered</Option>
                                    <Option value="cancelled">Cancelled</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Search</Text>
                                <Input.Search
                                    placeholder="Dispatch #, SO # or customer"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onSearch={fetchDispatches}
                                    style={{ width: 280 }}
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
                    dataSource={dispatches}
                    rowKey="id"
                    loading={loading}
                    onRow={(record) => ({
                        style: { cursor: 'pointer' },
                        onClick: () => navigate(`/app/dispatch/${record.id}`),
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
