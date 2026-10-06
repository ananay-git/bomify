import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Tag, Space, Typography, Spin, Tooltip, Divider, Input, InputNumber, Select, DatePicker, Modal } from 'antd';
import { message } from '@/lib/antdHelper';
import { LeftOutlined, PrinterOutlined, ShareAltOutlined, EditOutlined, CopyOutlined, StopOutlined, CheckCircleOutlined, InboxOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, PlusOutlined, LinkOutlined, ExportOutlined, WarningOutlined } from '@ant-design/icons';
import { purchasesApi, PurchaseOrder, DOCUMENT_TYPE_LABELS } from '@/features/purchases/api';
import type { GRN, DocumentType } from '@/features/purchases/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import { fetchPartyById, fetchParties, Party } from '@/features/parties/api/parties';
import { getUser } from '@/app/store';
import { extractApiError } from '@/lib/errors';
import AddCompanyForm from '@/components/layout/AddCompanyForm';
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = convert(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
    return result + ' Only';
}

interface EditableItem {
    key: number;
    item_id: number;
    ordered_quantity: number;
    unit_price: number;
}

export default function PurchaseOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const supplierNameParam = searchParams.get('supplierName');

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [supplier, setSupplier] = useState<Party | null>(null);
    const currentUser = getUser();

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState<EditableItem[]>([]);
    const [editNotes, setEditNotes] = useState<string>('');
    const [editDeliveryDate, setEditDeliveryDate] = useState<dayjs.Dayjs | null>(null);

    // Copy modal state
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [copyType, setCopyType] = useState<'all' | 'balance' | null>(null);
    const [supplierSelectModalOpen, setSupplierSelectModalOpen] = useState(false);
    const [allSuppliers, setAllSuppliers] = useState<Party[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [addCompanyOpen, setAddCompanyOpen] = useState(false);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);

    // Related Documents (GRNs)
    const [relatedGRNs, setRelatedGRNs] = useState<GRN[]>([]);
    const [loadingGRNs, setLoadingGRNs] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [poData, invData] = await Promise.all([
                    purchasesApi.getById(Number(id)),
                    inventoryApi.getAll()
                ]);
                setPo(poData);
                setInventoryItems(invData.items);
                if (poData.supplier_id) {
                    try { const s = await fetchPartyById(String(poData.supplier_id)); setSupplier(s); } catch {}
                }
            } catch { message.error('Failed to load Purchase Order'); }
            finally { setLoading(false); }
        };
        if (id) fetchData();
    }, [id]);

    // Fetch related GRNs
    useEffect(() => {
        const fetchGRNs = async () => {
            if (!id) return;
            setLoadingGRNs(true);
            try {
                const grns = await purchasesApi.listGRNsByPO(Number(id));
                setRelatedGRNs(grns);
            } catch { /* GRNs are optional */ }
            finally { setLoadingGRNs(false); }
        };
        fetchGRNs();
    }, [id]);

    const getInvItem = useCallback((itemId: number) => inventoryItems.find(i => i.id === itemId), [inventoryItems]);

    const enrichedItems = useMemo(() => {
        if (!po) return [];
        return po.items.map((item, idx) => {
            const inv = getInvItem(item.item_id);
            const taxableAmount = item.ordered_quantity * item.unit_price;
            // Stock level indicator
            let stockLevel: 'low' | 'medium' | 'ok' = 'ok';
            if (inv) {
                const currentStock = Number(inv.current_stock || 0);
                const reorderLevel = Number(inv.reorder_level || 0);
                if (currentStock <= reorderLevel) stockLevel = 'low';
                else if (currentStock <= reorderLevel * 2) stockLevel = 'medium';
            }
            return { ...item, idx: idx + 1, inv, taxableAmount, taxRate: inv?.tax || 0, taxAmount: taxableAmount * ((inv?.tax || 0) / 100), total: taxableAmount + taxableAmount * ((inv?.tax || 0) / 100), stockLevel };
        });
    }, [po, inventoryItems, getInvItem]);

    const totals = useMemo(() => {
        const totalBeforeTax = enrichedItems.reduce((s, i) => s + i.taxableAmount, 0);
        const totalTax = enrichedItems.reduce((s, i) => s + i.taxAmount, 0);
        return { totalBeforeTax, totalTax, totalAfterTax: totalBeforeTax + totalTax, grandTotal: totalBeforeTax + totalTax };
    }, [enrichedItems]);

    const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handlePrint = () => { window.print(); };

    const handleMarkComplete = async () => {
        if (!po) return;
        try {
            const updated = await purchasesApi.update(po.id, { invoice_status: 'complete' });
            message.success('Invoice marked as complete');
            setPo(updated);
        } catch { message.error('Failed to update status'); }
    };

    const isInvoiceComplete = po?.invoice_status === 'complete';
    const isGoodsReceived = po?.goods_status === 'received';

    // Cancel PO handler
    const handleCancelPO = async () => {
        if (!po) return;
        Modal.confirm({
            title: 'Cancel Purchase Order?',
            content: po.goods_status === 'received'
                ? 'This PO has received goods. Cancelling will reverse inventory adjustments. Continue?'
                : 'Are you sure you want to cancel this Purchase Order?',
            okText: 'Yes, Cancel',
            cancelText: 'No',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const updated = await purchasesApi.cancel(po.id);
                    setPo(updated);
                    message.success('Purchase Order cancelled successfully');
                } catch { message.error('Failed to cancel Purchase Order'); }
            },
        });
    };

    // --- Edit mode functions ---
    const handleStartEdit = () => {
        if (!po || (isInvoiceComplete && isGoodsReceived)) return;
        setEditItems(po.items.map((item, idx) => ({
            key: idx,
            item_id: item.item_id,
            ordered_quantity: item.ordered_quantity,
            unit_price: item.unit_price,
        })));
        setEditNotes(po.notes || '');
        setEditDeliveryDate(po.expected_delivery_date ? dayjs(po.expected_delivery_date) : null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const handleEditItemChange = (key: number, field: keyof EditableItem, value: any) => {
        setEditItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
    };

    const handleAddEditItem = () => {
        setEditItems(prev => [...prev, { key: Date.now(), item_id: 0, ordered_quantity: 0, unit_price: 0 }]);
    };

    const handleRemoveEditItem = (key: number) => {
        setEditItems(prev => prev.filter(item => item.key !== key));
    };

    const handleSaveEdit = async () => {
        if (!po) return;
        const validItems = editItems.filter(i => i.item_id > 0 && i.ordered_quantity > 0);
        if (validItems.length === 0) {
            message.error('Please add at least one valid item');
            return;
        }
        setSaving(true);
        try {
            const updated = await purchasesApi.update(po.id, {
                notes: editNotes || null,
                expected_delivery_date: editDeliveryDate?.toISOString() || null,
                items: validItems.map(i => ({ item_id: i.item_id, ordered_quantity: i.ordered_quantity, unit_price: i.unit_price })),
            });
            setPo(updated);
            setIsEditing(false);
            message.success('Purchase Order updated successfully');
        } catch (err) {
            message.error(extractApiError(err, 'Failed to update Purchase Order'));
        } finally {
            setSaving(false);
        }
    };

    // Edit mode totals
    const editTotals = useMemo(() => {
        const items = editItems.filter(i => i.item_id > 0 && i.ordered_quantity > 0);
        const totalBeforeTax = items.reduce((s, i) => {
            return s + i.ordered_quantity * i.unit_price;
        }, 0);
        const totalTax = items.reduce((s, i) => {
            const inv = getInvItem(i.item_id);
            return s + (i.ordered_quantity * i.unit_price * ((inv?.tax || 0) / 100));
        }, 0);
        return { totalBeforeTax, totalTax, grandTotal: totalBeforeTax + totalTax };
    }, [editItems, getInvItem]);

    // --- Copy functions ---
    const handleOpenCopyModal = () => { setCopyModalOpen(true); };

    const handleCopyChoice = async (type: 'all' | 'balance') => {
        setCopyType(type);
        setCopyModalOpen(false);
        setSupplierSelectModalOpen(true);
        setSelectedSupplierId(null);
        // Fetch suppliers
        setLoadingSuppliers(true);
        try {
            const data = await fetchParties('supplier');
            setAllSuppliers(data.parties);
        } catch { message.error('Failed to load suppliers'); }
        finally { setLoadingSuppliers(false); }
    };

    const handleCopyToSupplier = () => {
        if (!po || !selectedSupplierId || !copyType) return;
        const selectedSupplier = allSuppliers.find(s => s.id === selectedSupplierId);
        if (!selectedSupplier) { message.error('Please select a supplier'); return; }

        // Build items to pass
        const copiedItems = po.items.map(item => {
            const inv = getInvItem(item.item_id);
            let qty = item.ordered_quantity;
            if (copyType === 'balance') {
                qty = Math.max(0, item.ordered_quantity - item.received_quantity);
            }
            return {
                item_id: item.item_id,
                ordered_quantity: qty,
                unit_price: item.unit_price,
                description: inv?.name || '',
                hsn: inv?.hsn_code || '',
                units: inv?.unit_of_measure || '',
                currentStock: Number(inv?.current_stock || 0),
                tax: Number(inv?.tax || 0),
            };
        }).filter(i => i.ordered_quantity > 0);

        // Store in sessionStorage for CreatePurchaseOrderPage to pick up
        sessionStorage.setItem('po_copy_items', JSON.stringify(copiedItems));
        sessionStorage.setItem('po_copy_source', po.po_number);

        setSupplierSelectModalOpen(false);
        navigate(`/app/purchases/create?supplierId=${selectedSupplierId}&supplierName=${encodeURIComponent(selectedSupplier.name)}`);
    };

    const handleAddCompanySuccess = async () => {
        setAddCompanyOpen(false);
        setLoadingSuppliers(true);
        try {
            const data = await fetchParties('supplier');
            setAllSuppliers(data.parties);
            message.success('Company added! You can now select it.');
        } catch { message.error('Failed to refresh suppliers'); }
        finally { setLoadingSuppliers(false); }
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
    if (!po) return <div className="text-center py-20"><Text type="secondary">Purchase Order not found</Text></div>;

    const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
        draft:     { color: '#d48806', bg: '#fffbe6', border: '#ffe58f', label: 'DRAFT' },
        sent:      { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', label: 'CREATED' },
        partial:   { color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7', label: 'PARTIAL' },
        completed: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'COMPLETED' },
        cancelled: { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', label: 'CANCELLED' },
    };
    const cfg = statusConfig[po.status] || statusConfig.draft;

    const itemDropdownOptions = inventoryItems.map(inv => ({ value: inv.id, label: `${inv.sku} - ${inv.name}` }));

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }} className="print-area">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 no-print">
                <Space size="middle" align="center">
                    <Button icon={<LeftOutlined />} onClick={() => navigate('/app/purchases')} type="text" style={{ fontSize: 16, color: '#262626' }} />
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{po.po_number}</Title>
                    <Tag style={{ borderRadius: '16px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, padding: '2px 12px', fontWeight: 600, fontSize: 12 }}>{cfg.label}</Tag>
                    {isEditing && <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>EDITING</Tag>}
                </Space>
                <Button type="default" style={{ borderColor: '#52c41a', color: '#52c41a', fontWeight: 600 }} onClick={() => navigate('/app/purchases')}>Go to Transaction</Button>
            </div>

            {/* Sub-header Toolbar */}
            <div className="bg-white rounded-lg border border-gray-200 no-print" style={{ padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', marginBottom: 20 }}>
                <div className="flex justify-between items-center">
                    <Space size="small">
                        <Text strong style={{ fontSize: 14, color: '#262626' }}>PURCHASE ORDER DETAILS</Text>
                        <Tag color="green" style={{ borderRadius: 12, fontWeight: 500 }}>Default Stock Store</Tag>
                    </Space>
                    {isEditing ? (
                        <Space size="small">
                            <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>Cancel</Button>
                            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveEdit} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Save Changes</Button>
                        </Space>
                    ) : (
                        <Space size="small">
                            <Tooltip title="Print"><Button icon={<PrinterOutlined />} onClick={handlePrint} /></Tooltip>
                            <Tooltip title="Share"><Button icon={<ShareAltOutlined />} /></Tooltip>
                            <Tooltip title={isInvoiceComplete && isGoodsReceived ? 'Cannot edit completed PO' : 'Edit this document'}>
                                <Button icon={<EditOutlined />} onClick={handleStartEdit} disabled={isInvoiceComplete && isGoodsReceived}
                                    style={isInvoiceComplete && isGoodsReceived ? {} : { borderColor: '#1677ff', color: '#1677ff' }}>
                                    Amend
                                </Button>
                            </Tooltip>
                            <Tooltip title="Copy"><Button icon={<CopyOutlined />} onClick={handleOpenCopyModal}>Copy</Button></Tooltip>
                            <Tooltip title="Cancel"><Button icon={<StopOutlined />} danger onClick={handleCancelPO} disabled={po.status === 'cancelled' || po.status === 'completed'}>Cancel</Button></Tooltip>
                        </Space>
                    )}
                </div>
            </div>

            {/* Cross-Module Integration Panel */}
            <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {/* Related Documents */}
                <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '16px 20px' }}>
                    <Text strong style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>📄 Related Documents</Text>
                    {loadingGRNs ? (
                        <Spin size="small" />
                    ) : relatedGRNs.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>No inward documents yet</Text>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {relatedGRNs.map(grn => (
                                <div key={grn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                    <div>
                                        <a style={{ color: '#1677ff', fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onClick={() => navigate(`/app/purchases/${po.id}/inward/${grn.id}`)}>{grn.grn_number}</a>
                                        <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{new Date(grn.receipt_date).toLocaleDateString()}</Text>
                                    </div>
                                    <Tag color="green" style={{ borderRadius: 10, fontSize: 11 }}>{grn.items.length} items received</Tag>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Linked Sales Order + Inventory Overview */}
                <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '16px 20px' }}>
                    <Text strong style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>🔗 Cross-Module Links</Text>
                    
                    {/* Linked Sales Order */}
                    {po.linked_sales_order_id ? (
                        <div style={{ padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text style={{ fontSize: 11, color: '#6b7280' }}>Linked Sales Order</Text>
                                <div>
                                    <a style={{ color: '#1677ff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => navigate(`/app/sales/${po.linked_sales_order_id}`)}>
                                        <LinkOutlined style={{ marginRight: 4 }} />{po.linked_sales_order_number || `SO #${po.linked_sales_order_id}`}
                                    </a>
                                </div>
                            </div>
                            <Button size="small" type="link" icon={<ExportOutlined />} onClick={() => navigate(`/app/sales/${po.linked_sales_order_id}`)}>View</Button>
                        </div>
                    ) : (
                        <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', marginBottom: 10 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>No linked Sales Order</Text>
                        </div>
                    )}

                    {/* Supplier Quick Link */}
                    <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text style={{ fontSize: 11, color: '#6b7280' }}>Supplier</Text>
                            <div><a style={{ color: '#008b8b', fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onClick={() => navigate(`/app/companies/${po.supplier_id}`)}>{supplier?.name || po.supplier_name || 'View Supplier'}</a></div>
                        </div>
                        <Button size="small" type="link" icon={<ExportOutlined />} onClick={() => navigate(`/app/companies/${po.supplier_id}`)}>View</Button>
                    </div>

                    {/* Document Type */}
                    <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>Document Type</Text>
                        <div><Tag style={{ borderRadius: 10, marginTop: 4, fontWeight: 500 }}>{DOCUMENT_TYPE_LABELS[po.document_type as DocumentType] || 'Purchase Order'}</Tag></div>
                    </div>
                </div>
            </div>

            {/* PO Document Card */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 28, color: '#262626' }}>Purchase Order</Title>

                {/* Three column header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name and Address of Buyer</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{currentUser?.full_name || currentUser?.username || 'Checking'}</Text>
                        <div className="text-xs text-gray-500 leading-5">Main Address,<br/>Mumbai (Maharashtra-27)<br/>India - 400001</div>
                        <Divider style={{ margin: '10px 0' }} />
                        <div className="text-xs"><strong className="text-gray-600">Place of Supply:</strong> <span className="text-gray-500">Mumbai, Maharashtra (27)</span></div>
                    </div>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name and Address of Supplier</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{supplier?.name || supplierNameParam || 'Supplier'}</Text>
                        <div className="text-xs text-gray-500 leading-5">{supplier?.address1 || 'Address'}<br/>{supplier?.city || ''}, {supplier?.state || ''}<br/>{supplier?.country || 'India'} - {supplier?.pincode || ''}</div>
                        <Divider style={{ margin: '10px 0' }} />
                        <div className="text-xs"><strong className="text-gray-600">GSTIN:</strong> <span className="text-gray-500">{supplier?.gstin || 'N/A'}</span></div>
                    </div>
                    <div style={{ padding: 20, background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipping Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>Main</Text>
                        <div className="text-xs text-gray-500 leading-5">Main Address,<br/>Mumbai (Maharashtra)<br/>India - 400001</div>
                    </div>
                </div>

                {/* PO Details Grid */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ textAlign: 'center', background: '#f3f4f6', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                        <Text strong style={{ fontSize: 13, color: '#374151' }}>PO Details</Text>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Number</Text>
                            <Text strong style={{ fontSize: 13 }}>{po.po_number}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{dayjs(po.order_date).format('DD/MM/YYYY')}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Delivery Date</Text>
                            {isEditing ? (
                                <DatePicker size="small" value={editDeliveryDate} onChange={setEditDeliveryDate} format="DD/MM/YYYY" style={{ width: '100%' }} />
                            ) : (
                                <Text strong style={{ fontSize: 13 }}>{po.expected_delivery_date ? dayjs(po.expected_delivery_date).format('DD/MM/YYYY') : '-'}</Text>
                            )}
                        </div>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Amendment</Text>
                            <Text strong style={{ fontSize: 13 }}>0</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>No of Items</Text>
                            <Text strong style={{ fontSize: 13 }}>{isEditing ? editItems.length : po.items.length}</Text>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Amount</Text>
                            <Text strong style={{ fontSize: 13, color: '#0f766e' }}>{isEditing ? formatCurrency(editTotals.grandTotal) : formatCurrency(po.total_amount || totals.grandTotal)}</Text>
                        </div>
                    </div>
                </div>

                {/* Items Table — VIEW MODE */}
                {!isEditing ? (
                    <>
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 28 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f3f4f6' }}>
                                        <th style={thStyle}>#</th><th style={thStyle}>Description</th><th style={thStyle}>HSN/SAC Code</th><th style={thStyle}>Quantity</th><th style={thStyle}>Rate</th><th style={thStyle}>Taxable Amount</th><th style={{ ...thStyle, textAlign: 'center' }} colSpan={2}>IGST</th><th style={thStyle}>Total</th>
                                    </tr>
                                    <tr style={{ background: '#f9fafb' }}>
                                        <th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}>Rate</th><th style={thSubStyle}>Amount</th><th style={thSubStyle}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td style={tdStyle}>{item.idx}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <Text strong style={{ fontSize: 13 }}>{item.inv?.name || 'Item'}</Text><br/>
                                                        <span style={{ fontSize: 11, color: '#9ca3af' }}>Item ID: {item.inv?.sku || item.item_id}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                                        {item.inv && (
                                                            <Tooltip title={`Current Stock: ${Number(item.inv.current_stock || 0).toFixed(1)} ${item.inv.unit_of_measure || ''}`}>
                                                                <Tag 
                                                                    style={{ 
                                                                        borderRadius: 8, fontSize: 10, margin: 0, padding: '0px 6px', border: 'none',
                                                                        background: item.stockLevel === 'low' ? '#fff2f0' : item.stockLevel === 'medium' ? '#fffbe6' : '#f6ffed',
                                                                        color: item.stockLevel === 'low' ? '#ff4d4f' : item.stockLevel === 'medium' ? '#d48806' : '#52c41a',
                                                                    }}
                                                                >
                                                                    {item.stockLevel === 'low' && <WarningOutlined style={{ marginRight: 2 }} />}
                                                                    Stock: {Number(item.inv.current_stock || 0).toFixed(0)}
                                                                </Tag>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title="View in Inventory">
                                                            <a style={{ fontSize: 10, color: '#1677ff', cursor: 'pointer' }} onClick={() => navigate(`/app/inventory/${item.item_id}`)}>
                                                                <ExportOutlined style={{ marginRight: 3 }} />Inventory
                                                            </a>
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>{item.inv?.hsn_code || '-'}</td>
                                            <td style={tdStyle}>{Number(item.ordered_quantity).toFixed(2)} {item.inv?.unit_of_measure || ''}</td>
                                            <td style={tdStyle}>{formatCurrency(item.unit_price)}</td>
                                            <td style={tdStyle}>{formatCurrency(item.taxableAmount)}</td>
                                            <td style={{ ...tdStyle, color: '#0f766e', fontWeight: 600 }}>{item.taxRate}%</td>
                                            <td style={tdStyle}>{formatCurrency(item.taxAmount)}</td>
                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Amount in words */}
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 24, border: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', marginRight: 8 }}>PO Amount in words:</Text>
                            <Text style={{ color: '#0f766e', fontWeight: 500 }}>{numberToWords(totals.grandTotal)}</Text>
                        </div>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                            <div style={{ width: 400, background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Total (before Tax) :</Text><Text strong>{formatCurrency(totals.totalBeforeTax)}</Text></div>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 8, marginTop: 4, background: '#fff' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', textAlign: 'center', fontSize: 12 }}>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>CGST</Text><br/><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>SGST</Text><br/><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#0f766e' }}>IGST</Text><br/><Text style={{ fontSize: 12, color: '#0f766e' }}>{formatCurrency(totals.totalTax)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>Cess</Text><br/><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                    </div>
                                </div>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Total Tax :</Text><Text strong>{formatCurrency(totals.totalTax)}</Text></div>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Total (after Tax) :</Text><Text strong>{formatCurrency(totals.totalAfterTax)}</Text></div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div className="flex justify-between py-2"><Text strong style={{ fontSize: 15, color: '#262626' }}>Grand Total :</Text><Text strong style={{ fontSize: 15, color: '#0f766e' }}>{formatCurrency(totals.grandTotal)}</Text></div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Items Table — EDIT MODE */
                    <>
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '2px solid #1677ff', marginBottom: 16 }}>
                            <div style={{ background: '#e6f4ff', padding: '8px 16px', borderBottom: '1px solid #91caff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong style={{ color: '#1677ff', fontSize: 13 }}>✏️ Editing Items</Text>
                                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleAddEditItem}>Add Item</Button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f3f4f6' }}>
                                        <th style={thStyle}>#</th>
                                        <th style={{ ...thStyle, minWidth: 200 }}>Item</th>
                                        <th style={thStyle}>Quantity</th>
                                        <th style={thStyle}>Unit Price (₹)</th>
                                        <th style={thStyle}>Amount</th>
                                        <th style={{ ...thStyle, width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editItems.map((item, idx) => {
                                        const inv = getInvItem(item.item_id);
                                        return (
                                            <tr key={item.key} style={{ background: '#fff' }}>
                                                <td style={tdStyle}>{idx + 1}</td>
                                                <td style={tdStyle}>
                                                    <Select
                                                        style={{ width: '100%' }}
                                                        value={item.item_id || undefined}
                                                        onChange={(val) => {
                                                            const selectedInv = inventoryItems.find(i => i.id === val);
                                                            handleEditItemChange(item.key, 'item_id', val);
                                                            if (selectedInv) handleEditItemChange(item.key, 'unit_price', Number(selectedInv.default_price) || 0);
                                                        }}
                                                        options={itemDropdownOptions}
                                                        showSearch
                                                        optionFilterProp="label"
                                                        placeholder="Select item"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <InputNumber min={0} value={item.ordered_quantity} onChange={val => handleEditItemChange(item.key, 'ordered_quantity', val || 0)} style={{ width: 100 }} />
                                                    {inv && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{inv.unit_of_measure}</span>}
                                                </td>
                                                <td style={tdStyle}>
                                                    <InputNumber min={0} step={0.01} value={item.unit_price} onChange={val => handleEditItemChange(item.key, 'unit_price', val || 0)} style={{ width: 110 }} prefix="₹" />
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(item.ordered_quantity * item.unit_price)}</td>
                                                <td style={tdStyle}>
                                                    <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveEditItem(item.key)} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Edit Notes */}
                        <div style={{ marginBottom: 20 }}>
                            <Text strong style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Notes</Text>
                            <Input.TextArea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Add notes..." style={{ borderRadius: 8 }} />
                        </div>

                        {/* Edit Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                            <div style={{ width: 350, background: '#e6f4ff', borderRadius: 8, border: '1px solid #91caff', padding: '16px 20px' }}>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Subtotal :</Text><Text strong>{formatCurrency(editTotals.totalBeforeTax)}</Text></div>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Tax :</Text><Text strong>{formatCurrency(editTotals.totalTax)}</Text></div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div className="flex justify-between py-2"><Text strong style={{ fontSize: 15 }}>New Grand Total :</Text><Text strong style={{ fontSize: 15, color: '#1677ff' }}>{formatCurrency(editTotals.grandTotal)}</Text></div>
                            </div>
                        </div>
                    </>
                )}

                {/* Terms */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 28, background: '#fafbfc' }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13 }}>Terms And Conditions:</Text>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>This is a computer generated document</Text>
                </div>

                {/* Signature */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center', minWidth: 220 }}>
                        <Text style={{ color: '#9ca3af', display: 'block', marginBottom: po.signature_data?.image_base64 ? 8 : 60, fontSize: 13 }}>
                            For {po.signature_data?.signer_name || currentUser?.full_name || 'Checking'}
                        </Text>
                        {po.signature_data?.image_base64 && (
                            <div style={{ margin: '8px 0' }}>
                                <img 
                                    src={`data:image/png;base64,${po.signature_data.image_base64}`} 
                                    alt="Signature" 
                                    style={{ height: 60, objectFit: 'contain', margin: '0 auto' }} 
                                />
                            </div>
                        )}
                        <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
                            <Text style={{ color: '#6b7280', fontSize: 12 }}>Authorised Signatory</Text>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Tabs (view mode) */}
            {!isEditing && po && (
                <div className="mt-6 no-print">
                    <DocumentTabsSection
                        mode="view"
                        value={{
                            extra_charges: po.extra_charges || [],
                            attachments: po.attachments || [],
                            terms_conditions: po.terms_conditions || '',
                            notes: po.notes || '',
                            comments: po.comments || [],
                            additional_details: po.additional_details || [],
                            signature_data: po.signature_data || null,
                        }}
                        onChange={() => {}}
                    />
                </div>
            )}

            {/* Bottom Action Buttons */}
            {!isEditing && (
                <div className="flex justify-between items-center mt-6 no-print">
                    <Button
                        icon={<CheckCircleOutlined />}
                        style={{
                            borderColor: isInvoiceComplete ? '#d9d9d9' : '#52c41a',
                            color: isInvoiceComplete ? '#bfbfbf' : '#52c41a',
                            fontWeight: 600,
                            height: 40
                        }}
                        size="large"
                        onClick={handleMarkComplete}
                        disabled={isInvoiceComplete}
                    >
                        {isInvoiceComplete ? 'Invoice Complete' : 'Mark As Complete'}
                    </Button>
                    <Button
                        type="primary"
                        icon={<InboxOutlined />}
                        size="large"
                        style={{ background: '#1677ff', borderColor: '#1677ff', fontWeight: 600, height: 40 }}
                        onClick={() => navigate(`/app/purchases/${po.id}/inward/create`)}
                        disabled={isGoodsReceived}
                    >
                        {isGoodsReceived ? 'Goods Received' : 'Create Inward'}
                    </Button>
                </div>
            )}

            <style>{`
                @media print { .no-print { display: none !important; } .print-area { max-width: 100% !important; margin: 0 !important; padding: 0 !important; } }
            `}</style>

            {/* Modals for Copy Flow */}
            <Modal
                title="Copy Quantity"
                open={copyModalOpen}
                onCancel={() => setCopyModalOpen(false)}
                footer={null}
                width={400}
                centered
            >
                <div style={{ padding: '16px 0', display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <Button type="primary" style={{ background: '#0f766e', borderColor: '#0f766e' }} onClick={() => handleCopyChoice('all')}>
                        Copy all quantity
                    </Button>
                    <Button type="primary" style={{ background: '#0f766e', borderColor: '#0f766e' }} onClick={() => handleCopyChoice('balance')}>
                        Copy balance quantity
                    </Button>
                </div>
            </Modal>

            <Modal
                title="Select Supplier for Copied Order"
                open={supplierSelectModalOpen}
                onCancel={() => setSupplierSelectModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setSupplierSelectModalOpen(false)}>Cancel</Button>,
                    <Button key="continue" type="primary" onClick={handleCopyToSupplier} disabled={!selectedSupplierId}>Continue</Button>
                ]}
                width={500}
                centered
            >
                <div style={{ padding: '16px 0' }}>
                    <div style={{ marginBottom: 16 }}>Select a supplier for the new Purchase Order:</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Select
                            style={{ flex: 1 }}
                            showSearch
                            placeholder="Search and select supplier"
                            loading={loadingSuppliers}
                            value={selectedSupplierId}
                            onChange={(val) => setSelectedSupplierId(val)}
                            options={allSuppliers.map(s => ({ value: s.id, label: s.name }))}
                            optionFilterProp="label"
                        />
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setAddCompanyOpen(true)}
                        >
                            Add Company
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                title={null}
                open={addCompanyOpen}
                onCancel={() => setAddCompanyOpen(false)}
                footer={null}
                width={800}
                destroyOnHidden
            >
                <AddCompanyForm
                    initialType="supplier"
                    onSuccess={handleAddCompanySuccess}
                    onCancel={() => setAddCompanyOpen(false)}
                />
            </Modal>
        </div>
    );
}

const thStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, textAlign: 'left', color: '#374151' };
const thSubStyle: React.CSSProperties = { padding: '6px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 11, fontWeight: 500, textAlign: 'left', color: '#6b7280' };
const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 13, color: '#374151' };
