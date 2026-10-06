import { useEffect, useState } from "react";
import { Table, Button, Typography, Tag, Space, Dropdown, MenuProps, Input, Select, Row, Col, Modal, Tooltip } from "antd";
import { PlusOutlined, FilterOutlined, SearchOutlined, BankOutlined, ArrowUpOutlined, ArrowDownOutlined, LinkOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { purchasesApi, DOCUMENT_TYPE_LABELS } from "@/features/purchases/api";
import type { DocumentType } from "@/features/purchases/api";
import { fetchParties, Party } from "@/features/parties/api/parties";
import AddCompanyForm from "@/components/layout/AddCompanyForm";

const { Title, Text } = Typography;
const { Option } = Select;

export default function PurchaseOrderListPage() {
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [searchRowOpen, setSearchRowOpen] = useState(false);
    const [supplierModalVisible, setSupplierModalVisible] = useState(false);
    const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
    const [creationType, setCreationType] = useState<'po' | 'so' | 'order_conf' | 'service_conf' | 'invoice' | 'adhoc_invoice'>('po');
    const navigate = useNavigate();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [suppliers, setSuppliers] = useState<Party[]>([]);
    const [buyers, setBuyers] = useState<Party[]>([]);
    
    // Filters
    const [filterDocType, setFilterDocType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterGoodsService, setFilterGoodsService] = useState<string>("all");

    const fetchSuppliers = async () => {
        try {
            const data = await fetchParties("supplier");
            setSuppliers(data.parties);
        } catch (error) {
            console.error("Failed to load suppliers", error);
        }
    };

    const fetchBuyers = async () => {
        try {
            const data = await fetchParties("buyer");
            setBuyers(data.parties);
        } catch (error) {
            console.error("Failed to load buyers", error);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (filterDocType !== "all") params.document_type = filterDocType;
            if (filterStatus !== "all") params.status = filterStatus;
            
            const poData = await purchasesApi.getAll(params).catch(() => ({ orders: [] }));
            setOrders(poData.orders || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        fetchSuppliers();
        fetchBuyers();
    }, []);

    // Re-fetch when filters change
    useEffect(() => {
        fetchOrders();
    }, [filterDocType, filterStatus]);

    const handleCreatePO = () => {
        setCreationType('po');
        setSupplierModalVisible(true);
    };

    const handleCreateSO = () => {
        setCreationType('so');
        setSupplierModalVisible(true);
    };

    const handleCreateSalesDoc = (type: 'po' | 'so' | 'order_conf' | 'service_conf' | 'invoice' | 'adhoc_invoice') => {
        setCreationType(type);
        setSupplierModalVisible(true);
    };

    const handlePartySelect = (value: string, option?: { value: string; label: string } | { value: string; label: string }[]) => {
        if (!option) return;
        setSupplierModalVisible(false);
        const selected = Array.isArray(option) ? option[0] : option;
        
        const isBuyerType = ['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType);
        
        let targetRoute = '/app/purchases/create';
        if (creationType === 'so') targetRoute = '/app/purchases/service-orders/create';
        if (creationType === 'order_conf') targetRoute = '/app/purchases/order-confirmation/create';
        if (creationType === 'service_conf') targetRoute = '/app/purchases/service-confirmation/create';
        if (creationType === 'invoice') targetRoute = '/app/purchases/invoice/create';
        if (creationType === 'adhoc_invoice') targetRoute = '/app/purchases/adhoc-invoice/create';
        
        const paramKey = isBuyerType ? 'buyerId' : 'supplierId';
        const nameKey = isBuyerType ? 'buyerName' : 'supplierName';
        
        navigate(`${targetRoute}?${paramKey}=${value}&${nameKey}=${encodeURIComponent(selected.label)}`);
    };

    const documentMenuItems: MenuProps['items'] = [
        { key: '1', label: 'Purchase Order', onClick: handleCreatePO },
        { key: '2', label: 'Service Order', onClick: handleCreateSO },
        { key: '3', label: 'Order Confirmation', onClick: () => handleCreateSalesDoc('order_conf') },
        { key: '4', label: 'Service Confirmation', onClick: () => handleCreateSalesDoc('service_conf') },
        { key: '5', label: 'Invoice', onClick: () => handleCreateSalesDoc('invoice') },
        { key: '6', label: 'Adhoc Invoice', onClick: () => handleCreateSalesDoc('adhoc_invoice') },
    ];

    // Filter orders by goods/service on the client side
    const filteredOrders = orders.filter(o => {
        if (filterGoodsService === "all") return true;
        if (filterGoodsService === "goods") {
            return !["service_order", "service_confirmation"].includes(o.document_type);
        }
        if (filterGoodsService === "services") {
            return ["service_order", "service_confirmation"].includes(o.document_type);
        }
        return true;
    });

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
            title: renderColumnTitle("Company Name"),
            dataIndex: 'companyName',
            key: 'companyName',
            render: (text: string, record: any) => (
                <Space style={{ color: '#008b8b', fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate(`/app/companies/${record.supplierId}`)}>
                    <BankOutlined />
                    {text}
                </Space>
            ),
        },
        {
            title: renderColumnTitle("Document Number"),
            dataIndex: 'documentNumber',
            key: 'documentNumber',
            render: (text: string, record: any) => {
                const getDetailRoute = (rec: any) => {
                    const num = rec.documentNumber || '';
                    if (num.startsWith('OC-')) return `/app/purchases/order-confirmation/${rec.id}`;
                    if (num.startsWith('SC-')) return `/app/purchases/service-confirmation/${rec.id}`;
                    if (num.startsWith('INV-')) return `/app/purchases/invoice/${rec.id}`;
                    if (num.startsWith('ADOC-')) return `/app/purchases/adhoc-invoice/${rec.id}`;
                    if (num.startsWith('SO-')) return `/app/purchases/${rec.id}`;
                    return `/app/purchases/${rec.id}`;
                };
                return <a style={{ color: '#1890ff', fontWeight: 500 }} onClick={() => navigate(getDetailRoute(record))}>{text}</a>;
            },
        },
        {
            title: renderColumnTitle("Doc Type"),
            dataIndex: 'docTypeLabel',
            key: 'docTypeLabel',
            width: 160,
            render: (text: string) => {
                const typeColorMap: Record<string, { color: string; bg: string }> = {
                    'Purchase Order': { color: '#1677ff', bg: '#e6f4ff' },
                    'Service Order': { color: '#722ed1', bg: '#f9f0ff' },
                    'Order Confirmation': { color: '#13c2c2', bg: '#e6fffb' },
                    'Service Confirmation': { color: '#eb2f96', bg: '#fff0f6' },
                    'Invoice': { color: '#fa8c16', bg: '#fff7e6' },
                    'Adhoc Invoice': { color: '#a0d911', bg: '#fcffe6' },
                };
                const cfg = typeColorMap[text] || { color: '#595959', bg: '#f5f5f5' };
                return (
                    <Tag style={{ borderRadius: '12px', background: cfg.bg, border: 'none', color: cfg.color, padding: '2px 10px', fontWeight: 500, fontSize: 11 }}>
                        {text}
                    </Tag>
                );
            }
        },
        {
            title: renderColumnTitle("Transaction Details"),
            dataIndex: 'transactionDetails',
            key: 'transactionDetails',
            render: (text: string) => (
                <Text style={{ color: '#52c41a', fontWeight: 500 }}>{text}</Text>
            ),
        },
        {
            title: renderColumnTitle("Invoice Status"),
            dataIndex: 'invoiceStatus',
            key: 'invoiceStatus',
            render: (text: string) => (
                <Tag style={{ borderRadius: '16px', background: '#fff', border: '1px solid #52c41a', color: '#52c41a', padding: '2px 10px' }}>
                    {text}
                </Tag>
            ),
        },
        {
            title: renderColumnTitle("Goods Status"),
            dataIndex: 'goodsStatus',
            key: 'goodsStatus',
            render: (text: string) => {
                const isReceived = text === "Received";
                return (
                    <Tag 
                        style={{ 
                            borderRadius: '16px', 
                            background: '#fff', 
                            border: `1px solid ${isReceived ? '#52c41a' : '#ff4d4f'}`, 
                            color: isReceived ? '#52c41a' : '#ff4d4f',
                            padding: '2px 10px'
                        }}
                    >
                        {text}
                    </Tag>
                );
            }
        },
        {
            title: renderColumnTitle("Status"),
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
                    draft:     { color: '#d48806', bg: '#fffbe6', border: '#ffe58f', label: 'Draft' },
                    sent:      { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', label: 'Created' },
                    partial:   { color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7', label: 'Partial' },
                    completed: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'Completed' },
                    cancelled: { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', label: 'Cancelled' },
                };
                const cfg = statusConfig[status] || statusConfig.draft;
                return (
                    <Tag style={{ borderRadius: '16px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, padding: '2px 12px', fontWeight: 600, fontSize: 12 }}>
                        {cfg.label}
                    </Tag>
                );
            }
        },
        {
            title: renderColumnTitle("Linked SO", false),
            dataIndex: 'linkedSO',
            key: 'linkedSO',
            width: 130,
            render: (text: string | null, record: any) => {
                if (!text) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
                return (
                    <Tooltip title="View linked Sales Order">
                        <a 
                            style={{ color: '#1677ff', fontWeight: 500, fontSize: 12 }} 
                            onClick={() => navigate(`/app/sales/${record.linkedSOId}`)}
                        >
                            <LinkOutlined style={{ marginRight: 4 }} />{text}
                        </a>
                    </Tooltip>
                );
            }
        },
        {
            title: renderColumnTitle("Last Modified Date", false),
            dataIndex: 'lastModifiedDate',
            key: 'lastModifiedDate',
            render: (text: string) => <Text style={{ color: '#595959' }}>{text}</Text>,
        },
    ];

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>Purchases</Title>
                <Dropdown menu={{ items: documentMenuItems }} trigger={['click']}>
                    <Button type="primary" icon={<PlusOutlined />}>
                        Create Document
                    </Button>
                </Dropdown>
            </div>
            
            {/* White Card Container */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                
                {/* Filters Row */}
                <div style={{ marginBottom: '20px' }}>
                    {!moreFiltersOpen ? (
                        <Space size="large" align="center">
                            <div>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Transaction Type</Text>
                                <Select 
                                    value={filterDocType} 
                                    onChange={setFilterDocType} 
                                    style={{ width: 180 }}
                                >
                                    <Option value="all">All Documents</Option>
                                    <Option value="purchase_order">Purchase Order</Option>
                                    <Option value="service_order">Service Order</Option>
                                    <Option value="order_confirmation">Order Confirmation</Option>
                                    <Option value="service_confirmation">Service Confirmation</Option>
                                    <Option value="invoice">Invoice</Option>
                                    <Option value="adhoc_invoice">Adhoc Invoice</Option>
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
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Transaction Type</Text>
                                <Select 
                                    value={filterDocType} 
                                    onChange={setFilterDocType} 
                                    style={{ width: 180 }}
                                >
                                    <Option value="all">All Documents</Option>
                                    <Option value="purchase_order">Purchase Order</Option>
                                    <Option value="service_order">Service Order</Option>
                                    <Option value="order_confirmation">Order Confirmation</Option>
                                    <Option value="service_confirmation">Service Confirmation</Option>
                                    <Option value="invoice">Invoice</Option>
                                    <Option value="adhoc_invoice">Adhoc Invoice</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Goods/Services</Text>
                                <Select value={filterGoodsService} onChange={setFilterGoodsService} style={{ width: 160 }}>
                                    <Option value="all">All</Option>
                                    <Option value="goods">Goods Only</Option>
                                    <Option value="services">Services Only</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Transaction Status</Text>
                                <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 160 }}>
                                    <Option value="all">All</Option>
                                    <Option value="draft">Draft</Option>
                                    <Option value="sent">Created</Option>
                                    <Option value="partial">Partial</Option>
                                    <Option value="completed">Completed</Option>
                                    <Option value="cancelled">Cancelled</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Tags</Text>
                                <Select defaultValue="select" style={{ width: 160 }}>
                                    <Option value="select">Select</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Show/Hide Columns</Text>
                                <Select defaultValue="8" style={{ width: 180 }}>
                                    <Option value="8">8 columns selected</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Button type="link" icon={<SearchOutlined />} onClick={() => setMoreFiltersOpen(false)} style={{ fontWeight: 500 }}>
                                    Close Filters
                                </Button>
                                <Button type="link" icon={<SearchOutlined />} onClick={() => setSearchRowOpen(!searchRowOpen)} style={{ fontWeight: 500 }}>
                                    Search
                                </Button>
                            </Col>
                        </Row>
                    )}
                </div>

                <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 -24px 0 -24px' }} />

                {/* Table */}
                <Table
                    columns={columns}
                    dataSource={filteredOrders.length > 0 ? filteredOrders.map((o: any) => {
                        const supplierName = o.supplier_name || suppliers.find(s => s.id === o.supplier_id)?.name || buyers.find(b => b.id === o.supplier_id)?.name;
                        const docType = o.document_type || 'purchase_order';
                        const docTypeLabel = DOCUMENT_TYPE_LABELS[docType as DocumentType] || 'Purchase Order';
                        
                        return {
                        key: `${docType}-${o.id}`,
                        id: o.id,
                        supplierId: o.supplier_id,
                        companyName: supplierName || `Party #${o.supplier_id}`,
                        documentNumber: o.po_number,
                        docTypeLabel,
                        transactionDetails: `${docTypeLabel} ₹${Number(o.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        invoiceStatus: o.invoice_status === 'complete' ? 'Complete' : 'Pending',
                        goodsStatus: o.goods_status === 'received' ? 'Received' : 'Not Received',
                        status: o.status,
                        linkedSO: o.linked_sales_order_number || null,
                        linkedSOId: o.linked_sales_order_id || null,
                        lastModifiedDate: new Date(o.updated_at || o.created_at).toLocaleString(),
                    }}) : []}
                    loading={loading}
                    pagination={{
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        defaultPageSize: 10,
                        showTotal: (total, range) => `${range[0]} to ${range[1]} of ${total}`,
                        style: { padding: '16px 24px', margin: 0, borderTop: '1px solid #f0f0f0' }
                    }}
                    rowKey="key"
                    size="middle"
                    className="custom-purchases-table"
                />
            </div>
            
            {/* Party Selection Modal */}
            <Modal
                title={
                    <div className="flex justify-between items-center pr-6">
                        <span style={{ color: '#001529', fontWeight: 600 }}>
                            {['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType) 
                                ? 'Please Add/Select Buyer' 
                                : 'Please Add/Select Supplier'}
                        </span>
                        <Button 
                            size="small" 
                            type="primary"
                            onClick={() => {
                                setSupplierModalVisible(false);
                                setCreateCompanyOpen(true);
                            }}
                        >
                            Add New Company
                        </Button>
                    </div>
                }
                open={supplierModalVisible}
                onCancel={() => setSupplierModalVisible(false)}
                footer={null}
                width={500}
                styles={{ body: { padding: '24px 0 12px' } }}
                closeIcon={<span style={{ background: '#fff', borderRadius: '50%', padding: '4px', border: '1px solid #d9d9d9', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</span>}
            >
                <div style={{ marginBottom: 8 }}>
                    <Text className="text-gray-600">
                        {['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType) 
                            ? 'Select Buyer' 
                            : 'Select Supplier'}
                    </Text>
                </div>
                <Select
                    showSearch
                    placeholder={['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType) ? "Search buyer..." : "Search supplier..."}
                    style={{ width: '100%' }}
                    onChange={handlePartySelect}
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={
                        ['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType)
                            ? buyers.map(b => ({ value: String(b.id), label: b.name }))
                            : suppliers.map(s => ({ value: String(s.id), label: s.name }))
                    }
                />
            </Modal>

            {/* Create Company Modal */}
            <Modal
                open={createCompanyOpen}
                onCancel={() => setCreateCompanyOpen(false)}
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
                    initialType={['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType) ? "buyer" : "supplier"}
                    onCancel={() => setCreateCompanyOpen(false)}
                    onSuccess={() => {
                        setCreateCompanyOpen(false);
                        if (['order_conf', 'service_conf', 'invoice', 'adhoc_invoice'].includes(creationType)) {
                            fetchBuyers();
                        } else {
                            fetchSuppliers();
                        }
                        setSupplierModalVisible(true);
                    }}
                />
            </Modal>

            <style>{`
                .custom-purchases-table .ant-table-thead > tr > th {
                    background: #fff;
                    border-bottom: 1px solid #f0f0f0;
                    padding: 12px 16px;
                }
                .custom-purchases-table .ant-table-tbody > tr > td {
                    padding: 16px;
                }
                .custom-purchases-table .ant-table-pagination.ant-pagination {
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
