import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Button, Tag, Space, Typography, message, Spin, Tooltip, Divider,
    Input, Modal, Timeline
} from 'antd';
import {
    LeftOutlined, PrinterOutlined, ShareAltOutlined,
    StopOutlined, CheckCircleOutlined, TruckOutlined,
    InboxOutlined, ClockCircleOutlined, CloseCircleOutlined,
    ExclamationCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined
} from '@ant-design/icons';
import { dispatchApi, DispatchRecord, DispatchStatus } from '@/features/dispatch/api';
import { getUser } from '@/app/store';
import { extractApiError } from '@/lib/errors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { confirm: modalConfirm } = Modal;

// ─── Helpers ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<DispatchStatus, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
    draft:     { color: '#8c8c8c', bg: '#fafafa',  border: '#d9d9d9', label: 'DRAFT',     icon: <ClockCircleOutlined /> },
    packed:    { color: '#fa8c16', bg: '#fff7e6',  border: '#ffd591', label: 'PACKED',    icon: <InboxOutlined /> },
    shipped:   { color: '#1677ff', bg: '#e6f4ff',  border: '#91caff', label: 'SHIPPED',   icon: <TruckOutlined /> },
    delivered: { color: '#52c41a', bg: '#f6ffed',  border: '#b7eb8f', label: 'DELIVERED', icon: <CheckCircleOutlined /> },
    cancelled: { color: '#ff4d4f', bg: '#fff2f0',  border: '#ffccc7', label: 'CANCELLED', icon: <CloseCircleOutlined /> },
};

const thStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, textAlign: 'left', color: '#374151' };
const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 13, color: '#374151' };

// ─── Component ─────────────────────────────────────────────────

export default function DispatchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const currentUser = getUser();

    const [dispatch, setDispatch] = useState<DispatchRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Edit mode for logistics details
    const [isEditing, setIsEditing] = useState(false);
    const [editTracking, setEditTracking] = useState('');
    const [editLogistics, setEditLogistics] = useState('');
    const [editVehicle, setEditVehicle] = useState('');
    const [editDriverName, setEditDriverName] = useState('');
    const [editDriverPhone, setEditDriverPhone] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await dispatchApi.getById(Number(id));
                setDispatch(data);
            } catch {
                message.error('Failed to load dispatch');
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchData();
    }, [id]);

    // ─── Status Actions ────────────────────────────────────────

    const handlePack = () => {
        if (!dispatch) return;
        modalConfirm({
            title: 'Pack Dispatch?',
            icon: <InboxOutlined style={{ color: '#fa8c16' }} />,
            content: 'This will deduct inventory stock for all items. Continue?',
            okText: 'Yes, Pack',
            okType: 'primary',
            onOk: async () => {
                setActionLoading(true);
                try {
                    const updated = await dispatchApi.pack(dispatch.id);
                    setDispatch(updated);
                    message.success('Dispatch marked as Packed. Inventory deducted.');
                } catch (err) {
                    message.error(extractApiError(err, 'Failed to pack dispatch'));
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const handleShip = () => {
        if (!dispatch) return;
        modalConfirm({
            title: 'Ship Dispatch?',
            icon: <TruckOutlined style={{ color: '#1677ff' }} />,
            content: 'This will mark the dispatch as shipped. Continue?',
            okText: 'Yes, Ship',
            onOk: async () => {
                setActionLoading(true);
                try {
                    const updated = await dispatchApi.ship(dispatch.id, {
                        tracking_number: dispatch.tracking_number || undefined,
                        logistics_partner: dispatch.logistics_partner || undefined,
                    });
                    setDispatch(updated);
                    message.success('Dispatch marked as Shipped!');
                } catch (err) {
                    message.error(extractApiError(err, 'Failed to ship dispatch'));
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const handleDeliver = () => {
        if (!dispatch) return;
        modalConfirm({
            title: 'Mark as Delivered?',
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            content: 'Confirm that the goods have been delivered to the customer.',
            okText: 'Yes, Delivered',
            onOk: async () => {
                setActionLoading(true);
                try {
                    const updated = await dispatchApi.deliver(dispatch.id);
                    setDispatch(updated);
                    message.success('Dispatch delivered!');
                } catch (err) {
                    message.error(extractApiError(err, 'Failed to mark as delivered'));
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const handleCancel = () => {
        if (!dispatch) return;
        const willRestoreStock = dispatch.status === 'packed';
        modalConfirm({
            title: 'Cancel Dispatch?',
            icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
            content: willRestoreStock
                ? 'This dispatch is packed. Cancelling will RESTORE inventory stock. This cannot be undone.'
                : 'This will cancel the dispatch. This cannot be undone.',
            okText: 'Yes, Cancel',
            okType: 'danger',
            onOk: async () => {
                setActionLoading(true);
                try {
                    const updated = await dispatchApi.cancel(dispatch.id);
                    setDispatch(updated);
                    message.success(willRestoreStock
                        ? 'Dispatch cancelled. Stock restored.'
                        : 'Dispatch cancelled.');
                } catch (err) {
                    message.error(extractApiError(err, 'Failed to cancel dispatch'));
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    // ─── Edit Mode ─────────────────────────────────────────────

    const handleStartEdit = () => {
        if (!dispatch) return;
        setEditTracking(dispatch.tracking_number || '');
        setEditLogistics(dispatch.logistics_partner || '');
        setEditVehicle(dispatch.vehicle_details || '');
        setEditDriverName(dispatch.driver_name || '');
        setEditDriverPhone(dispatch.driver_phone || '');
        setEditNotes(dispatch.notes || '');
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!dispatch) return;
        setSaving(true);
        try {
            const updated = await dispatchApi.update(dispatch.id, {
                tracking_number: editTracking || null,
                logistics_partner: editLogistics || null,
                vehicle_details: editVehicle || null,
                driver_name: editDriverName || null,
                driver_phone: editDriverPhone || null,
                notes: editNotes || null,
            });
            setDispatch(updated);
            setIsEditing(false);
            message.success('Dispatch updated');
        } catch (err) {
            message.error(extractApiError(err, 'Failed to update'));
        } finally {
            setSaving(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────

    if (loading) return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
    if (!dispatch) return <div className="text-center py-20"><Text type="secondary">Dispatch not found</Text></div>;

    const so = dispatch.sales_order;
    const isPaid = so?.status === 'paid';
    const effectiveStatus = isPaid ? 'delivered' : dispatch.status;
    const normalizedStatus = effectiveStatus ? String(effectiveStatus).toLowerCase() as DispatchStatus : 'draft';
    const cfg = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.draft;
    const canEdit = !isPaid && ['draft', 'packed'].includes(normalizedStatus);
    const canCancel = !isPaid && ['draft', 'packed'].includes(normalizedStatus);
    const customer = so?.customer;

    // Next action button
    const getNextAction = (): { label: string; handler: () => void; icon: React.ReactNode; color: string } | null => {
        switch (normalizedStatus) {
            case 'draft': return { label: 'Mark as Packed', handler: handlePack, icon: <InboxOutlined />, color: '#fa8c16' };
            case 'packed': return { label: 'Ship Now', handler: handleShip, icon: <TruckOutlined />, color: '#1677ff' };
            case 'shipped': return { label: 'Mark Delivered', handler: handleDeliver, icon: <CheckCircleOutlined />, color: '#52c41a' };
            default: return null;
        }
    };

    const nextAction = getNextAction();

    // Timeline
    const timelineItems = [
        { color: 'gray' as const, content: <><Text strong>Dispatch Created</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(dispatch.created_at).format('DD MMM YYYY, hh:mm A')}</Text></> },
        ...(normalizedStatus !== 'draft' ? [{
            color: (normalizedStatus === 'cancelled' ? 'red' : 'green') as 'red' | 'green',
            content: <><Text strong>Status: {cfg.label}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(dispatch.updated_at).format('DD MMM YYYY, hh:mm A')}</Text></>
        }] : []),
        ...(dispatch.delivered_date ? [{
            color: 'green' as const,
            content: <><Text strong>Delivered</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(dispatch.delivered_date).format('DD MMM YYYY, hh:mm A')}</Text></>
        }] : []),
    ];

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }} className="print-area">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 no-print">
                <Space size="middle" align="center">
                    <Button icon={<LeftOutlined />} onClick={() => navigate('/app/dispatch')} type="text" style={{ fontSize: 16, color: '#262626' }} />
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{dispatch.dispatch_number}</Title>
                    <Tag
                        icon={cfg.icon}
                        style={{ borderRadius: '16px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, padding: '2px 12px', fontWeight: 600, fontSize: 12 }}
                    >
                        {cfg.label}
                    </Tag>
                    {isEditing && <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>EDITING</Tag>}
                </Space>
                <Button type="default" style={{ borderColor: '#52c41a', color: '#52c41a', fontWeight: 600 }} onClick={() => navigate('/app/dispatch')}>Go to Dispatches</Button>
            </div>

            {/* Sub-header Toolbar */}
            <div className="bg-white rounded-lg border border-gray-200 no-print" style={{ padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', marginBottom: 20 }}>
                <div className="flex justify-between items-center">
                    <Space size="small">
                        <Text strong style={{ fontSize: 14, color: '#262626' }}>DISPATCH DETAILS</Text>
                        {dispatch.logistics_partner && <Tag color="geekblue" style={{ borderRadius: 12, fontWeight: 500 }}>{dispatch.logistics_partner}</Tag>}
                        {dispatch.tracking_number && <Tag color="cyan" style={{ borderRadius: 12, fontWeight: 500 }}>#{dispatch.tracking_number}</Tag>}
                    </Space>
                    {isEditing ? (
                        <Space size="small">
                            <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveEdit} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Save Changes</Button>
                        </Space>
                    ) : (
                        <Space size="small">
                            <Tooltip title="Print"><Button icon={<PrinterOutlined />} onClick={() => window.print()} /></Tooltip>
                            <Tooltip title="Share"><Button icon={<ShareAltOutlined />} /></Tooltip>
                            <Tooltip title={canEdit ? 'Edit logistics details' : 'Cannot edit in current status'}>
                                <Button icon={<EditOutlined />} onClick={handleStartEdit} disabled={!canEdit}
                                    style={canEdit ? { borderColor: '#1677ff', color: '#1677ff' } : {}}>
                                    Amend
                                </Button>
                            </Tooltip>
                            {canCancel && (
                                <Tooltip title="Cancel Dispatch">
                                    <Button icon={<StopOutlined />} danger onClick={handleCancel} loading={actionLoading}>Cancel</Button>
                                </Tooltip>
                            )}
                        </Space>
                    )}
                </div>
            </div>

            {/* Document Card */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 28, color: '#262626' }}>Dispatch Note</Title>

                {/* Three column header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seller Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{currentUser?.full_name || currentUser?.username || 'Company'}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            Main Address,<br />
                            Mumbai (Maharashtra)<br />
                            India
                        </div>
                    </div>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{customer?.name || `Customer #${so?.customer_id || ''}`}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {customer?.address || ''}<br />
                            {customer?.city || ''}, {customer?.state || ''}<br />
                            India - {customer?.pincode || ''}
                        </div>
                        <Divider style={{ margin: '10px 0' }} />
                        <div className="text-xs"><strong className="text-gray-600">GSTIN:</strong> <span className="text-gray-500">{customer?.gstin || 'N/A'}</span></div>
                    </div>
                    <div style={{ padding: 20, background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipping Details</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{customer?.name || 'Customer'}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {customer?.address || ''}<br />
                            {customer?.city || ''}, {customer?.state || ''}<br />
                            India - {customer?.pincode || ''}
                        </div>
                        {customer?.phone && <div className="text-xs text-gray-500 mt-2">☎ {customer.phone}</div>}
                    </div>
                </div>

                {/* Dispatch Details Grid */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ textAlign: 'center', background: '#f3f4f6', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                        <Text strong style={{ fontSize: 13, color: '#374151' }}>Dispatch Details</Text>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Dispatch Number</Text>
                            <Text strong style={{ fontSize: 13 }}>{dispatch.dispatch_number}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Sales Order</Text>
                            <a style={{ fontSize: 13, fontWeight: 600, color: '#13c2c2' }} onClick={() => navigate(`/app/sales/${dispatch.sales_order_id}`)}>{so?.order_number || `SO #${dispatch.sales_order_id}`}</a>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Dispatch Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{dispatch.dispatch_date ? dayjs(dispatch.dispatch_date).format('DD/MM/YYYY') : '-'}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Expected Delivery</Text>
                            <Text strong style={{ fontSize: 13 }}>{dispatch.expected_delivery ? dayjs(dispatch.expected_delivery).format('DD/MM/YYYY') : '-'}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Logistics Partner</Text>
                            {isEditing ? (
                                <Input size="small" value={editLogistics} onChange={e => setEditLogistics(e.target.value)} placeholder="Partner" />
                            ) : (
                                <Text strong style={{ fontSize: 13 }}>{dispatch.logistics_partner || '-'}</Text>
                            )}
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Tracking Number</Text>
                            {isEditing ? (
                                <Input size="small" value={editTracking} onChange={e => setEditTracking(e.target.value)} placeholder="Tracking #" />
                            ) : (
                                <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{dispatch.tracking_number || '-'}</Text>
                            )}
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Driver</Text>
                            {isEditing ? (
                                <Input size="small" value={editDriverName} onChange={e => setEditDriverName(e.target.value)} placeholder="Driver name" />
                            ) : (
                                <Text strong style={{ fontSize: 13 }}>{dispatch.driver_name || '-'}{dispatch.driver_phone ? ` (${dispatch.driver_phone})` : ''}</Text>
                            )}
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Vehicle</Text>
                            {isEditing ? (
                                <Input size="small" value={editVehicle} onChange={e => setEditVehicle(e.target.value)} placeholder="Vehicle details" />
                            ) : (
                                <Text strong style={{ fontSize: 13 }}>{dispatch.vehicle_details || '-'}</Text>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 28 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>Product</th>
                                <th style={thStyle}>SKU</th>
                                <th style={thStyle}>UOM</th>
                                <th style={thStyle}>Dispatch Qty</th>
                                <th style={thStyle}>Picked</th>
                                <th style={thStyle}>Packed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dispatch.items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td style={tdStyle}>{idx + 1}</td>
                                    <td style={tdStyle}>
                                        <Text strong style={{ fontSize: 13 }}>{item.item_name || `Product #${item.product_id}`}</Text>
                                    </td>
                                    <td style={tdStyle}>{item.item_sku || '-'}</td>
                                    <td style={tdStyle}>{item.item_uom || '-'}</td>
                                    <td style={{ ...tdStyle, fontWeight: 600, color: '#0f766e' }}>{Number(item.quantity).toFixed(2)}</td>
                                    <td style={tdStyle}>{Number(item.picked_quantity).toFixed(2)}</td>
                                    <td style={tdStyle}>{Number(item.packed_quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Notes */}
                {(dispatch.notes || isEditing) && (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 28, background: '#fafbfc' }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13 }}>Notes:</Text>
                        {isEditing ? (
                            <Input.TextArea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Delivery notes..." />
                        ) : (
                            <Text style={{ color: '#6b7280', fontSize: 13 }}>{dispatch.notes}</Text>
                        )}
                    </div>
                )}

                {/* Signature */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center', minWidth: 220 }}>
                        <Text style={{ color: '#9ca3af', display: 'block', marginBottom: 60, fontSize: 13 }}>For {currentUser?.full_name || 'Company'}</Text>
                        <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8 }}><Text style={{ color: '#6b7280', fontSize: 12 }}>Authorised Signatory</Text></div>
                    </div>
                </div>
            </div>

            {/* Bottom Action Buttons & Timeline */}
            {!isEditing && (
                <div className="mt-6 no-print">
                    <div className="flex justify-between items-start">
                        {/* Timeline */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6" style={{ width: 360 }}>
                            <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>Dispatch Timeline</Text>
                            <Timeline items={timelineItems} />
                        </div>

                        {/* Action Buttons */}
                        <Space size="middle">
                            {canCancel && (
                                <Button icon={<StopOutlined />} danger size="large" onClick={handleCancel} loading={actionLoading}
                                    style={{ fontWeight: 600, height: 40 }}>
                                    Cancel Dispatch
                                </Button>
                            )}
                            {nextAction && (
                                <Button icon={nextAction.icon} size="large" loading={actionLoading}
                                    onClick={nextAction.handler}
                                    style={{ borderColor: nextAction.color, color: '#fff', background: nextAction.color, fontWeight: 600, height: 40 }}>
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
