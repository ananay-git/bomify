import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Button, Tag, Space, Typography, message, Spin, Tooltip, Divider,
    Input, InputNumber, Select, DatePicker, Modal, Timeline
} from 'antd';
import {
    LeftOutlined, PrinterOutlined, ShareAltOutlined, EditOutlined,
    StopOutlined, CheckCircleOutlined, SaveOutlined, CloseOutlined,
    DeleteOutlined, PlusOutlined, TruckOutlined, FileTextOutlined,
    DollarOutlined, CarryOutOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import { salesApi, SalesOrder, OrderStatus } from '@/features/sales/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import { getUser } from '@/app/store';
import { extractApiError } from '@/lib/errors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { confirm: modalConfirm } = Modal;

// ─── Helpers ───────────────────────────────────────────────────

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

interface EditableItem {
    key: number;
    item_id: number;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
}

// ─── Component ─────────────────────────────────────────────────

export default function SalesOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const currentUser = getUser();

    const [so, setSo] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editItems, setEditItems] = useState<EditableItem[]>([]);
    const [editNotes, setEditNotes] = useState<string>('');
    const [editDeliveryDate, setEditDeliveryDate] = useState<dayjs.Dayjs | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [soData, invData] = await Promise.all([
                    salesApi.getById(Number(id)),
                    inventoryApi.getAll(),
                ]);
                setSo(soData);
                setInventoryItems(invData.items);
            } catch {
                message.error('Failed to load Sales Order');
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchData();
    }, [id]);

    const getInvItem = useCallback((itemId: number) => inventoryItems.find(i => i.id === itemId), [inventoryItems]);

    const enrichedItems = useMemo(() => {
        if (!so) return [];
        return so.items.map((item, idx) => {
            const inv = getInvItem(item.item_id);
            const discountAmt = item.quantity * item.unit_price * ((item.discount || 0) / 100);
            const taxableAmount = item.quantity * item.unit_price - discountAmt;
            const taxRate = item.tax_rate || inv?.tax || 0;
            const taxAmount = taxableAmount * (taxRate / 100);
            const total = taxableAmount + taxAmount;
            return { ...item, idx: idx + 1, inv, taxableAmount, taxRate, taxAmount, total, discountAmt };
        });
    }, [so, getInvItem]);

    const totals = useMemo(() => {
        const totalBeforeTax = enrichedItems.reduce((s, i) => s + i.taxableAmount, 0);
        const totalTax = enrichedItems.reduce((s, i) => s + i.taxAmount, 0);
        const totalDiscount = enrichedItems.reduce((s, i) => s + i.discountAmt, 0);
        return { totalBeforeTax, totalTax, totalDiscount, grandTotal: totalBeforeTax + totalTax };
    }, [enrichedItems]);

    const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ─── Status Actions ────────────────────────────────────────

    const handleStatusAction = async (action: 'confirm' | 'process' | 'ship' | 'invoice' | 'pay' | 'cancel') => {
        if (!so) return;

        const actionMap: Record<string, { fn: (id: number) => Promise<SalesOrder>; label: string; confirm?: string }> = {
            confirm: { fn: salesApi.confirm, label: 'Confirmed', confirm: 'This will reserve inventory stock for all items. Continue?' },
            process: { fn: salesApi.process, label: 'Processing' },
            ship: { fn: salesApi.ship, label: 'Shipped', confirm: 'This will mark items as dispatched. Continue?' },
            invoice: { fn: salesApi.invoice, label: 'Invoiced' },
            pay: { fn: salesApi.markPaid, label: 'Paid' },
            cancel: { fn: salesApi.cancel, label: 'Cancelled', confirm: 'This will cancel the order and release any reserved stock. This action cannot be undone.' },
        };

        const cfg = actionMap[action];

        const doAction = async () => {
            setActionLoading(true);
            try {
                const updated = await cfg.fn(so.id);
                setSo(updated);
                message.success(`Order marked as ${cfg.label}`);

                // If confirmed or processing, prompt to create dispatch
                if (action === 'confirm' || action === 'process') {
                    modalConfirm({
                        title: 'Ready for Dispatch?',
                        icon: <TruckOutlined style={{ color: '#1677ff' }} />,
                        content: `This order is now ${cfg.label}. Would you like to create a dispatch note right now?`,
                        okText: 'Yes, Create Dispatch',
                        cancelText: 'Maybe Later',
                        onOk: () => navigate(`/app/dispatch/create?so_id=${so.id}`),
                    });
                }
            } catch (err) {
                message.error(extractApiError(err, `Failed to ${action} order`));
            } finally {
                setActionLoading(false);
            }
        };

        if (cfg.confirm) {
            modalConfirm({
                title: `${action.charAt(0).toUpperCase() + action.slice(1)} Order?`,
                icon: action === 'cancel' ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                content: cfg.confirm,
                okText: action === 'cancel' ? 'Yes, Cancel' : 'Yes, Proceed',
                okType: action === 'cancel' ? 'danger' : 'primary',
                onOk: doAction,
            });
        } else {
            await doAction();
        }
    };

    // ─── Edit Mode ─────────────────────────────────────────────

    const handleStartEdit = () => {
        if (!so || !['draft', 'quotation_sent'].includes(so.status)) return;
        setEditItems(so.items.map((item, idx) => ({
            key: idx,
            item_id: item.item_id,
            description: item.description || item.item_name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount || 0,
            tax_rate: item.tax_rate || 0,
        })));
        setEditNotes(so.notes || '');
        setEditDeliveryDate(so.expected_delivery_date ? dayjs(so.expected_delivery_date) : null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => { setIsEditing(false); setEditItems([]); };

    const handleEditItemChange = (key: number, field: keyof EditableItem, value: unknown) => {
        setEditItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
    };

    const handleAddEditItem = () => {
        setEditItems(prev => [...prev, { key: Date.now(), item_id: 0, description: '', quantity: 0, unit_price: 0, discount: 0, tax_rate: 0 }]);
    };

    const handleRemoveEditItem = (key: number) => {
        setEditItems(prev => prev.filter(item => item.key !== key));
    };

    const handleSaveEdit = async () => {
        if (!so) return;
        const validItems = editItems.filter(i => i.item_id > 0 && i.quantity > 0);
        if (validItems.length === 0) { message.error('Please add at least one valid item'); return; }
        setSaving(true);
        try {
            const updated = await salesApi.update(so.id, {
                notes: editNotes || null,
                expected_delivery_date: editDeliveryDate?.toISOString() || null,
                items: validItems.map(i => ({
                    item_id: i.item_id,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    discount: i.discount,
                    tax_rate: i.tax_rate,
                })),
            });
            setSo(updated);
            setIsEditing(false);
            message.success('Sales Order updated successfully');
        } catch (err) {
            message.error(extractApiError(err, 'Failed to update Sales Order'));
        } finally { setSaving(false); }
    };

    const editTotals = useMemo(() => {
        const items = editItems.filter(i => i.item_id > 0 && i.quantity > 0);
        const totalBeforeTax = items.reduce((s, i) => {
            const gross = i.quantity * i.unit_price;
            return s + gross * (1 - (i.discount || 0) / 100);
        }, 0);
        const totalTax = items.reduce((s, i) => {
            const gross = i.quantity * i.unit_price;
            const net = gross * (1 - (i.discount || 0) / 100);
            return s + net * ((i.tax_rate || 0) / 100);
        }, 0);
        return { totalBeforeTax, totalTax, grandTotal: totalBeforeTax + totalTax };
    }, [editItems]);

    // ─── Render ────────────────────────────────────────────────

    if (loading) return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
    if (!so) return <div className="text-center py-20"><Text type="secondary">Sales Order not found</Text></div>;

    const cfg = STATUS_CONFIG[so.status] || STATUS_CONFIG.draft;
    const canEdit = ['draft', 'quotation_sent'].includes(so.status);
    const canCancel = ['draft', 'quotation_sent', 'confirmed', 'processing'].includes(so.status);
    const itemDropdownOptions = inventoryItems.map(inv => ({ value: inv.id, label: `${inv.sku} - ${inv.name}` }));

    // Status-specific action button
    const getNextAction = (): { label: string; action: string; icon: React.ReactNode; color: string; borderColor: string } | null => {
        switch (so.status) {
            case 'draft': return { label: 'Confirm Order', action: 'confirm', icon: <CheckCircleOutlined />, color: '#52c41a', borderColor: '#52c41a' };
            case 'quotation_sent': return { label: 'Confirm Order', action: 'confirm', icon: <CheckCircleOutlined />, color: '#52c41a', borderColor: '#52c41a' };
            case 'confirmed': return { label: 'Start Processing', action: 'process', icon: <CarryOutOutlined />, color: '#fa8c16', borderColor: '#fa8c16' };
            case 'processing': return { label: 'Mark Shipped', action: 'ship', icon: <TruckOutlined />, color: '#1677ff', borderColor: '#1677ff' };
            case 'shipped': return { label: 'Create Invoice', action: 'invoice', icon: <FileTextOutlined />, color: '#13c2c2', borderColor: '#13c2c2' };
            case 'invoiced': return { label: 'Mark as Paid', action: 'pay', icon: <DollarOutlined />, color: '#389e0d', borderColor: '#389e0d' };
            default: return null;
        }
    };

    const nextAction = getNextAction();

    // Timeline entries from order dates
    const timelineItems = [
        { color: 'gray', children: <><Text strong>Order Created</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(so.created_at).format('DD MMM YYYY, hh:mm A')}</Text></> },
        ...(so.status !== 'draft' ? [{ color: 'green' as const, children: <><Text strong>Status: {cfg.label}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(so.updated_at).format('DD MMM YYYY, hh:mm A')}</Text></> }] : []),
    ];

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }} className="print-area">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 no-print">
                <Space size="middle" align="center">
                    <Button icon={<LeftOutlined />} onClick={() => navigate('/app/sales')} type="text" style={{ fontSize: 16, color: '#262626' }} />
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{so.order_number}</Title>
                    <Tag style={{ borderRadius: '16px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, padding: '2px 12px', fontWeight: 600, fontSize: 12 }}>{cfg.label}</Tag>
                    {isEditing && <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>EDITING</Tag>}
                </Space>
                <Button type="default" style={{ borderColor: '#52c41a', color: '#52c41a', fontWeight: 600 }} onClick={() => navigate('/app/sales')}>Go to Transactions</Button>
            </div>

            {/* Sub-header Toolbar */}
            <div className="bg-white rounded-lg border border-gray-200 no-print" style={{ padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', marginBottom: 20 }}>
                <div className="flex justify-between items-center">
                    <Space size="small">
                        <Text strong style={{ fontSize: 14, color: '#262626' }}>SALES ORDER DETAILS</Text>
                        {so.payment_terms && <Tag color="geekblue" style={{ borderRadius: 12, fontWeight: 500 }}>{so.payment_terms}</Tag>}
                    </Space>
                    {isEditing ? (
                        <Space size="small">
                            <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>Cancel</Button>
                            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveEdit} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Save Changes</Button>
                        </Space>
                    ) : (
                        <Space size="small">
                            <Tooltip title="Print"><Button icon={<PrinterOutlined />} onClick={() => window.print()} /></Tooltip>
                            <Tooltip title="Share"><Button icon={<ShareAltOutlined />} /></Tooltip>
                            <Tooltip title={canEdit ? 'Edit this document' : 'Cannot edit in current status'}>
                                <Button icon={<EditOutlined />} onClick={handleStartEdit} disabled={!canEdit}
                                    style={canEdit ? { borderColor: '#1677ff', color: '#1677ff' } : {}}>
                                    Amend
                                </Button>
                            </Tooltip>
                            {canCancel && (
                                <Tooltip title="Cancel Order">
                                    <Button icon={<StopOutlined />} danger onClick={() => handleStatusAction('cancel')} loading={actionLoading}>Cancel</Button>
                                </Tooltip>
                            )}
                        </Space>
                    )}
                </div>
            </div>

            {/* SO Document Card */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 28, color: '#262626' }}>Sales Order</Title>

                {/* Three column header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seller Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{currentUser?.full_name || currentUser?.username || 'Company'}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {so.billing_address?.address || 'Main Address,'}<br />
                            {so.billing_address?.city || 'Mumbai'} ({so.billing_address?.state || 'Maharashtra'})<br />
                            India - {so.billing_address?.pincode || '400001'}
                        </div>
                    </div>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{so.customer?.name || `Buyer #${so.customer_id}`}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {so.customer?.address || ''}<br />
                            {so.customer?.city || ''}, {so.customer?.state || ''}<br />
                            India - {so.customer?.pincode || ''}
                        </div>
                        <Divider style={{ margin: '10px 0' }} />
                        <div className="text-xs"><strong className="text-gray-600">GSTIN:</strong> <span className="text-gray-500">{so.customer?.gstin || 'N/A'}</span></div>
                    </div>
                    <div style={{ padding: 20, background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipping Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{so.customer?.name || 'Buyer'}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {so.shipping_address?.address || so.customer?.address || ''}<br />
                            {so.shipping_address?.city || so.customer?.city || ''}, {so.shipping_address?.state || so.customer?.state || ''}<br />
                            India - {so.shipping_address?.pincode || so.customer?.pincode || ''}
                        </div>
                    </div>
                </div>

                {/* SO Details Grid */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ textAlign: 'center', background: '#f3f4f6', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                        <Text strong style={{ fontSize: 13, color: '#374151' }}>SO Details</Text>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>SO Number</Text>
                            <Text strong style={{ fontSize: 13 }}>{so.order_number}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Order Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{dayjs(so.order_date).format('DD/MM/YYYY')}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Delivery Date</Text>
                            {isEditing ? (
                                <DatePicker size="small" value={editDeliveryDate} onChange={setEditDeliveryDate} format="DD/MM/YYYY" style={{ width: '100%' }} />
                            ) : (
                                <Text strong style={{ fontSize: 13 }}>{so.expected_delivery_date ? dayjs(so.expected_delivery_date).format('DD/MM/YYYY') : '-'}</Text>
                            )}
                        </div>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Payment Terms</Text>
                            <Text strong style={{ fontSize: 13 }}>{so.payment_terms || 'N/A'}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>No of Items</Text>
                            <Text strong style={{ fontSize: 13 }}>{isEditing ? editItems.length : so.items.length}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>SO Amount</Text>
                            <Text strong style={{ fontSize: 13, color: '#0f766e' }}>{isEditing ? formatCurrency(editTotals.grandTotal) : formatCurrency(so.total_amount || totals.grandTotal)}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Tax Amount</Text>
                            <Text strong style={{ fontSize: 13 }}>{formatCurrency(so.tax_amount || totals.totalTax)}</Text>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Discount</Text>
                            <Text strong style={{ fontSize: 13, color: '#fa8c16' }}>{formatCurrency(so.discount_amount || totals.totalDiscount)}</Text>
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
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>Description</th>
                                        <th style={thStyle}>HSN/SAC</th>
                                        <th style={thStyle}>Quantity</th>
                                        <th style={thStyle}>Rate</th>
                                        <th style={thStyle}>Discount</th>
                                        <th style={thStyle}>Taxable Amt</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }} colSpan={2}>IGST</th>
                                        <th style={thStyle}>Total</th>
                                    </tr>
                                    <tr style={{ background: '#f9fafb' }}>
                                        <th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th>
                                        <th style={thSubStyle}></th><th style={thSubStyle}></th><th style={thSubStyle}></th>
                                        <th style={thSubStyle}></th><th style={thSubStyle}>Rate</th><th style={thSubStyle}>Amount</th><th style={thSubStyle}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td style={tdStyle}>{item.idx}</td>
                                            <td style={tdStyle}>
                                                <Text strong style={{ fontSize: 13 }}>{item.item_name || item.description || 'Item'}</Text><br />
                                                <span style={{ fontSize: 11, color: '#9ca3af' }}>SKU: {item.item_sku || item.item_id}</span>
                                            </td>
                                            <td style={tdStyle}>{item.item_hsn || '-'}</td>
                                            <td style={tdStyle}>{Number(item.quantity).toFixed(2)} {item.item_uom || ''}</td>
                                            <td style={tdStyle}>{formatCurrency(item.unit_price)}</td>
                                            <td style={tdStyle}>{item.discount > 0 ? `${item.discount}%` : '-'}</td>
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
                            <Text style={{ fontSize: 11, color: '#9ca3af', marginRight: 8 }}>SO Amount in words:</Text>
                            <Text style={{ color: '#0f766e', fontWeight: 500 }}>{numberToWords(totals.grandTotal)}</Text>
                        </div>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                            <div style={{ width: 400, background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                                {totals.totalDiscount > 0 && (
                                    <div className="flex justify-between py-2"><Text style={{ color: '#fa8c16' }}>Discount :</Text><Text strong style={{ color: '#fa8c16' }}>- {formatCurrency(totals.totalDiscount)}</Text></div>
                                )}
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Total (before Tax) :</Text><Text strong>{formatCurrency(totals.totalBeforeTax)}</Text></div>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 8, marginTop: 4, background: '#fff' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', textAlign: 'center', fontSize: 12 }}>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>CGST</Text><br /><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>SGST</Text><br /><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#0f766e' }}>IGST</Text><br /><Text style={{ fontSize: 12, color: '#0f766e' }}>{formatCurrency(totals.totalTax)}</Text></div>
                                        <div><Text strong style={{ fontSize: 11, color: '#6b7280' }}>Cess</Text><br /><Text style={{ fontSize: 12 }}>{formatCurrency(0)}</Text></div>
                                    </div>
                                </div>
                                <div className="flex justify-between py-2"><Text style={{ color: '#6b7280' }}>Total Tax :</Text><Text strong>{formatCurrency(totals.totalTax)}</Text></div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div className="flex justify-between py-2"><Text strong style={{ fontSize: 15, color: '#262626' }}>Grand Total :</Text><Text strong style={{ fontSize: 15, color: '#0f766e' }}>{formatCurrency(totals.grandTotal)}</Text></div>
                            </div>
                        </div>

                        {/* Notes */}
                        {so.notes && (
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 28, background: '#fafbfc' }}>
                                <Text strong style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13 }}>Notes:</Text>
                                <Text style={{ color: '#6b7280', fontSize: 13 }}>{so.notes}</Text>
                            </div>
                        )}

                        {/* Terms */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 28, background: '#fafbfc' }}>
                            <Text strong style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13 }}>Terms And Conditions:</Text>
                            <Text style={{ color: '#6b7280', fontSize: 13 }}>This is a computer generated document</Text>
                        </div>

                        {/* Signature */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ textAlign: 'center', minWidth: 220 }}>
                                <Text style={{ color: '#9ca3af', display: 'block', marginBottom: so.signature_data?.image_base64 ? 8 : 60, fontSize: 13 }}>
                                    For {so.signature_data?.signer_name || currentUser?.full_name || 'Company'}
                                </Text>
                                {so.signature_data?.image_base64 && (
                                    <div style={{ margin: '8px 0' }}>
                                        <img 
                                            src={`data:image/png;base64,${so.signature_data.image_base64}`} 
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
                                        <th style={thStyle}>Price (₹)</th>
                                        <th style={thStyle}>Discount %</th>
                                        <th style={thStyle}>Tax %</th>
                                        <th style={thStyle}>Amount</th>
                                        <th style={{ ...thStyle, width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editItems.map((item, idx) => {
                                        const gross = item.quantity * item.unit_price;
                                        const net = gross * (1 - (item.discount || 0) / 100);
                                        const tax = net * ((item.tax_rate || 0) / 100);
                                        return (
                                            <tr key={item.key} style={{ background: '#fff' }}>
                                                <td style={tdStyle}>{idx + 1}</td>
                                                <td style={tdStyle}>
                                                    <Select style={{ width: '100%' }} value={item.item_id || undefined}
                                                        onChange={(val) => {
                                                            const selectedInv = inventoryItems.find(i => i.id === val);
                                                            handleEditItemChange(item.key, 'item_id', val);
                                                            if (selectedInv) {
                                                                handleEditItemChange(item.key, 'unit_price', Number(selectedInv.default_price) || 0);
                                                                handleEditItemChange(item.key, 'description', selectedInv.name);
                                                                handleEditItemChange(item.key, 'tax_rate', Number(selectedInv.tax) || 0);
                                                            }
                                                        }}
                                                        options={itemDropdownOptions} showSearch optionFilterProp="label" placeholder="Select item" />
                                                </td>
                                                <td style={tdStyle}><InputNumber min={0} value={item.quantity} onChange={val => handleEditItemChange(item.key, 'quantity', val || 0)} style={{ width: 100 }} /></td>
                                                <td style={tdStyle}><InputNumber min={0} step={0.01} value={item.unit_price} onChange={val => handleEditItemChange(item.key, 'unit_price', val || 0)} style={{ width: 110 }} prefix="₹" /></td>
                                                <td style={tdStyle}><InputNumber min={0} max={100} value={item.discount} onChange={val => handleEditItemChange(item.key, 'discount', val || 0)} style={{ width: 80 }} suffix="%" /></td>
                                                <td style={tdStyle}><InputNumber min={0} max={100} value={item.tax_rate} onChange={val => handleEditItemChange(item.key, 'tax_rate', val || 0)} style={{ width: 80 }} suffix="%" /></td>
                                                <td style={{ ...tdStyle, fontWeight: 600, color: '#0f766e' }}>{formatCurrency(net + tax)}</td>
                                                <td style={tdStyle}><Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveEditItem(item.key)} /></td>
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
            </div>

            {/* Document Tabs (view mode) */}
            {!isEditing && so && (
                <div className="mt-6 no-print">
                    <DocumentTabsSection
                        mode="view"
                        value={{
                            extra_charges: so.extra_charges || [],
                            attachments: so.attachments || [],
                            terms_conditions: so.terms_conditions || '',
                            notes: so.notes || '',
                            comments: so.comments || [],
                            additional_details: so.additional_details || [],
                            signature_data: so.signature_data || null,
                        }}
                        onChange={() => {}}
                    />
                </div>
            )}

            {/* Bottom Action Buttons & Timeline */}
            {!isEditing && (
                <div className="mt-6 no-print">
                    <div className="flex justify-between items-start">
                        {/* Timeline */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6" style={{ width: 360 }}>
                            <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>Order Timeline</Text>
                            <Timeline items={timelineItems} />
                        </div>

                        {/* Action Buttons */}
                        <Space size="middle">
                            {canCancel && (
                                <Button icon={<StopOutlined />} danger size="large" onClick={() => handleStatusAction('cancel')} loading={actionLoading}
                                    style={{ fontWeight: 600, height: 40 }}>
                                    Cancel Order
                                </Button>
                            )}
                            {(so.status === 'confirmed' || so.status === 'processing') && (
                                <Button icon={<TruckOutlined />} size="large" onClick={() => navigate(`/app/dispatch/create?so_id=${so.id}`)}
                                    style={{ borderColor: '#2f54eb', color: '#2f54eb', fontWeight: 600, height: 40 }}>
                                    Create Dispatch
                                </Button>
                            )}
                            {nextAction && (
                                <Button icon={nextAction.icon} size="large" loading={actionLoading}
                                    onClick={() => handleStatusAction(nextAction.action as 'confirm' | 'process' | 'ship' | 'invoice' | 'pay')}
                                    style={{ borderColor: nextAction.borderColor, color: '#fff', background: nextAction.color, fontWeight: 600, height: 40 }}>
                                    {nextAction.label}
                                </Button>
                            )}
                        </Space>
                    </div>
                </div>
            )}

            <style>{`
                @media print { .no-print { display: none !important; } .print-area { max-width: 100% !important; margin: 0 !important; padding: 0 !important; } }
            `}</style>
        </div>
    );
}

const thStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, textAlign: 'left', color: '#374151' };
const thSubStyle: React.CSSProperties = { padding: '6px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 11, fontWeight: 500, textAlign: 'left', color: '#6b7280' };
const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 13, color: '#374151' };
