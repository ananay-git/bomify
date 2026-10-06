import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, Space, Typography, Spin, Divider } from 'antd';
import { message } from '@/lib/antdHelper';
import { LeftOutlined, PrinterOutlined, QrcodeOutlined, StopOutlined } from '@ant-design/icons';
import DocumentTabsSection from '@/components/shared/DocumentTabsSection';
import { purchasesApi, PurchaseOrder, GRN } from '@/features/purchases/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import { fetchPartyById, Party } from '@/features/parties/api/parties';
import { getUser } from '@/app/store';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function InwardDetailPage() {
    const { id, grnId } = useParams<{ id: string; grnId: string }>();
    const navigate = useNavigate();
    const currentUser = getUser();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [grn, setGrn] = useState<GRN | null>(null);
    const [loading, setLoading] = useState(true);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [supplier, setSupplier] = useState<Party | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [poData, grnData, invData] = await Promise.all([
                    purchasesApi.getById(Number(id)),
                    purchasesApi.getGRN(Number(grnId)),
                    inventoryApi.getAll()
                ]);
                setPo(poData);
                setGrn(grnData);
                setInventoryItems(invData.items);
                if (poData.supplier_id) {
                    try {
                        const s = await fetchPartyById(String(poData.supplier_id));
                        setSupplier(s);
                    } catch {}
                }
            } catch {
                message.error('Failed to load Inward Document');
            } finally {
                setLoading(false);
            }
        };
        if (id && grnId) fetchData();
    }, [id, grnId]);

    const getInvItem = useCallback(
        (itemId: number) => inventoryItems.find(i => i.id === itemId),
        [inventoryItems]
    );

    const enrichedItems = useMemo(() => {
        if (!grn || !po) return [];
        return grn.items.map((grnItem, idx) => {
            const inv = getInvItem(grnItem.item_id);
            const poItem = po.items.find(p => p.item_id === grnItem.item_id);
            const deliveredEarlier = poItem ? Math.max(0, poItem.received_quantity - grnItem.received_quantity) : 0;
            const balance = poItem ? Math.max(0, poItem.ordered_quantity - poItem.received_quantity) : 0;
            return {
                ...grnItem,
                idx: idx + 1,
                inv,
                poItem,
                orderedQty: poItem?.ordered_quantity || 0,
                deliveredEarlier,
                deliveredToday: grnItem.received_quantity,
                balance
            };
        });
    }, [grn, po, getInvItem]);




    if (loading) return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
    if (!po || !grn) return <div className="text-center py-20"><Text type="secondary">Inward Document not found</Text></div>;

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <Space size="middle" align="center">
                    <Button icon={<LeftOutlined />} onClick={() => navigate(`/app/purchases/${po.id}`)} type="text" style={{ fontSize: 16, color: '#262626' }} />
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{grn.grn_number}</Title>
                    <Tag style={{ borderRadius: '16px', background: '#e6f4ff', border: '1px solid #91caff', color: '#1677ff', padding: '2px 12px', fontWeight: 600, fontSize: 12 }}>CREATED</Tag>
                </Space>
                <Button type="default" style={{ borderColor: '#52c41a', color: '#52c41a', fontWeight: 600 }} onClick={() => navigate(`/app/purchases/${po.id}`)}>Go to Transaction</Button>
            </div>

            {/* Sub-header Toolbar */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', marginBottom: 20 }}>
                <div className="flex justify-between items-center">
                    <Space size="small">
                        <Text strong style={{ fontSize: 14, color: '#262626' }}>INWARD DOCUMENT DETAILS</Text>
                        <Tag color="green" style={{ borderRadius: 12, fontWeight: 500 }}>Default Stock Store</Tag>
                    </Space>
                    <Space size="small">
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()} />
                        <Button icon={<QrcodeOutlined />}>Barc...</Button>
                        <Button icon={<StopOutlined />} danger />
                    </Space>
                </div>
            </div>

            {/* Document Card */}
            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 28, color: '#262626' }}>Inward Document</Title>

                {/* Three column header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goods Received By</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{currentUser?.full_name || currentUser?.username || 'Checking'}</Text>
                        <div className="text-xs text-gray-500 leading-5">Main Address,<br/>Mumbai (Maharashtra)<br/>India - 400001</div>
                    </div>
                    <div style={{ padding: 20, borderRight: '1px solid #e5e7eb', background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goods Sent By</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{supplier?.name || 'Supplier'}</Text>
                        <div className="text-xs text-gray-500 leading-5">
                            {supplier?.address1 || 'Address'}<br/>
                            {supplier?.city || ''}, {supplier?.state || ''}<br/>
                            {supplier?.country || 'India'} - {supplier?.pincode || ''}
                        </div>
                        <Divider style={{ margin: '10px 0' }} />
                        <div className="text-xs"><strong className="text-gray-600">GSTIN:</strong> <span className="text-blue-500">{supplier?.gstin || 'N/A'}</span></div>
                    </div>
                    <div style={{ padding: 20, background: '#fafbfc' }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipped To</Text>
                        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>Main</Text>
                        <div className="text-xs text-gray-500 leading-5">Main Address,<br/>Mumbai (Maharashtra)<br/>India - 400001</div>
                    </div>
                </div>

                {/* Inward Details Grid */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
                    <div style={{ textAlign: 'center', background: '#f3f4f6', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                        <Text strong style={{ fontSize: 13, color: '#374151' }}>Inward Details</Text>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Inward Number</Text>
                            <Text strong style={{ fontSize: 13 }}>{grn.grn_number}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Inward Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{dayjs(grn.receipt_date).format('DD/MM/YYYY')}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Delivery Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{grn.delivery_date ? dayjs(grn.delivery_date).format('DD/MM/YYYY') : dayjs(grn.receipt_date).format('DD/MM/YYYY')}</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Amendment</Text>
                            <Text strong style={{ fontSize: 13 }}>0</Text>
                        </div>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #e5e7eb' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Number</Text>
                            <Text strong style={{ fontSize: 13, color: '#1677ff', cursor: 'pointer' }} onClick={() => navigate(`/app/purchases/${po.id}`)}>{po.po_number}</Text>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>PO Date</Text>
                            <Text strong style={{ fontSize: 13 }}>{dayjs(po.order_date).format('DD/MM/YYYY')}</Text>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 28 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>Description</th>
                                <th style={thStyle}>Quantity</th>
                                <th style={thStyle}>Delivered Earlier</th>
                                <th style={thStyle}>Delivered Today</th>
                                <th style={thStyle}>Balance</th>
                                <th style={thStyle}>Stock After Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {enrichedItems.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td style={tdStyle}>{item.idx}</td>
                                    <td style={tdStyle}>
                                        <Text strong style={{ fontSize: 13 }}>{item.inv?.name || 'Item'}</Text>
                                        <br />
                                        <span onClick={() => navigate(`/app/inventory/${item.item_id}`)} style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', textDecoration: 'underline' }}>Item ID: {item.inv?.sku || item.item_id}</span>
                                    </td>
                                    <td style={tdStyle}>{Number(item.orderedQty).toFixed(2)} {item.inv?.unit_of_measure || 'Kg'}</td>
                                    <td style={tdStyle}>{Number(item.deliveredEarlier).toFixed(2)} {item.inv?.unit_of_measure || 'Kg'}</td>
                                    <td style={{ ...tdStyle, fontWeight: 600, color: '#0f766e' }}>{Number(item.deliveredToday).toFixed(2)} {item.inv?.unit_of_measure || 'Kg'}</td>
                                    <td style={tdStyle}>{Number(item.balance).toFixed(2)} {item.inv?.unit_of_measure || 'Kg'}</td>
                                    <td style={tdStyle}>
                                        <div className="flex flex-col">
                                            <Text strong style={{ color: '#0f766e', fontSize: 13 }}>
                                                {Number(item.inv?.current_stock || 0)} {item.inv?.unit_of_measure || 'Kg'}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 10 }}>Updated in Inventory</Text>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Section */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                    <div style={{ width: '400px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text className="text-gray-500">Total Items in Document:</Text>
                            <Text strong>{enrichedItems.length}</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text className="text-gray-500">Total Quantity Received Today:</Text>
                            <Text strong style={{ color: '#0f766e' }}>
                                {enrichedItems.reduce((acc, item) => acc + item.deliveredToday, 0).toFixed(2)}
                            </Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #cbd5e1' }}>
                            <Text strong>Remaining Balance Quantity:</Text>
                            <Text strong style={{ color: '#b91c1c' }}>
                                {enrichedItems.reduce((acc, item) => acc + item.balance, 0).toFixed(2)}
                            </Text>
                        </div>
                    </div>
                </div>

                {/* Terms */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 28, background: '#fafbfc' }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13 }}>Terms And Conditions:</Text>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>This is a computer generated document</Text>
                </div>

                {/* Signature */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center', minWidth: 220 }}>
                        <Text style={{ color: '#9ca3af', display: 'block', marginBottom: 60, fontSize: 13 }}>For Checking</Text>
                        <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
                            <Text style={{ color: '#6b7280', fontSize: 12 }}>Authorised Signatory</Text>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    color: '#374151'
};

const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    fontSize: 13,
    color: '#374151'
};
