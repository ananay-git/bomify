import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, DatePicker, Select, Button, Table, Typography, Row, Col, Space, Divider, Tabs, Spin } from 'antd';
import { message } from '@/lib/antdHelper';
import {
    LeftOutlined, UploadOutlined, EditOutlined, InboxOutlined,
    AppstoreAddOutlined, CloseOutlined, QuestionCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import { purchasesApi, PurchaseOrder } from '@/features/purchases/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import { fetchPartyById, Party } from '@/features/parties/api/parties';
import { getUser } from '@/app/store';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function CreateInwardPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const currentUser = getUser();

    const [form] = Form.useForm();
    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [supplier, setSupplier] = useState<Party | null>(null);
    const [comment, setComment] = useState('');
    const [deliveryDate, setDeliveryDate] = useState<dayjs.Dayjs>(dayjs());
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [selectedOptionalColumns, setSelectedOptionalColumns] = useState<string[]>([]);
    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);
    
    // Per-item delivered now values
    const [deliveredNowValues, setDeliveredNowValues] = useState<Record<number, number>>({});

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

                // Initialize delivered now values = ordered quantity (full delivery by default)
                const initValues: Record<number, number> = {};
                poData.items.forEach(item => {
                    initValues[item.item_id] = item.ordered_quantity;
                });
                setDeliveredNowValues(initValues);

                if (poData.supplier_id) {
                    try {
                        const s = await fetchPartyById(String(poData.supplier_id));
                        setSupplier(s);
                    } catch {}
                }
            } catch {
                message.error('Failed to load Purchase Order');
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchData();
    }, [id]);

    const getInvItem = useCallback(
        (itemId: number) => inventoryItems.find(i => i.id === itemId),
        [inventoryItems]
    );

    const wrnNumber = useMemo(() => {
        return `WR${String(Date.now()).slice(-5)}`;
    }, []);

    const handleSave = async (mode: 'draft' | 'send') => {
        if (!po) return;

        const grnItems = po.items.map(item => ({
            item_id: item.item_id,
            received_quantity: deliveredNowValues[item.item_id] || 0,
            accepted_quantity: deliveredNowValues[item.item_id] || 0,
            rejected_quantity: 0
        })).filter(item => item.received_quantity > 0);

        if (grnItems.length === 0) {
            message.error('Please enter delivery quantities for at least one item');
            return;
        }

        setSaving(true);
        try {
            const grn = await purchasesApi.createGRN({
                po_id: po.id,
                grn_number: wrnNumber,
                delivery_date: deliveryDate.toISOString(),
                notes: comment || null,
                items: grnItems
            });

            if (mode === 'send') {
                message.success('Inward document created successfully!');
                navigate(`/app/purchases/${po.id}/inward/${grn.id}`);
            } else {
                message.success('Inward draft saved');
                navigate(`/app/purchases/${po.id}`);
            }
        } catch (err) {
            console.error(err);
            message.error('Failed to create inward document');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadTemplate = () => {
        if (!po) return;
        const headers = ['Item ID', 'Description', 'Ordered Quantity', 'Delivered Earlier', 'Delivered Now'];
        const dataRows = po.items.map(item => {
            const inv = getInvItem(item.item_id);
            return [
                inv?.sku || `SKU${String(item.item_id).padStart(5, '0')}`,
                inv?.name || 'Item',
                item.ordered_quantity,
                item.received_quantity,
                deliveredNowValues[item.item_id] || 0
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Items');
        XLSX.writeFile(wb, `inward_template_${wrnNumber}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Spin size="large" />
            </div>
        );
    }

    if (!po) {
        return (
            <div className="text-center py-20">
                <Text type="secondary">Purchase Order not found</Text>
            </div>
        );
    }

    const itemColumns = [
        {
            title: 'Item ID',
            dataIndex: 'item_id',
            key: 'item_id',
            width: 140,
            render: (_: any, record: any) => (
                <Text className="text-[12px] text-blue-600 font-medium cursor-pointer">{record.sku}</Text>
            )
        },
        {
            title: 'Item Description',
            dataIndex: 'description',
            key: 'description',
            render: (_: any, record: any) => (
                <Text className="text-[12px] text-slate-700">{record.description}</Text>
            )
        },
        {
            title: 'Quantity',
            dataIndex: 'ordered_quantity',
            key: 'ordered_quantity',
            width: 90,
            render: (val: number) => <Text className="text-[12px] text-slate-700">{val}</Text>
        },
        {
            title: 'Units',
            dataIndex: 'units',
            key: 'units',
            width: 90,
            render: (_: any, record: any) => (
                <Text className="text-[12px] text-slate-700">{record.units}</Text>
            )
        },
        {
            title: 'Current Stock',
            dataIndex: 'currentStock',
            key: 'currentStock',
            width: 120,
            render: (val: number) => <Text className="text-[12px] text-slate-600">{val}</Text>
        },
        {
            title: 'Delivery Date',
            key: 'deliveryDate',
            width: 140,
            render: () => (
                <DatePicker size="small" defaultValue={deliveryDate} format="DD/MM/YYYY" style={{ width: 120 }} />
            )
        },
        {
            title: 'Delivered',
            dataIndex: 'received_quantity',
            key: 'received_quantity',
            width: 100,
            render: (val: number) => <Text className="text-[12px] text-slate-600">{val}</Text>
        },
        {
            title: 'Delivered Now',
            key: 'deliveredNow',
            width: 120,
            render: (_: any, record: any) => (
                <Input
                    type="number"
                    size="small"
                    value={deliveredNowValues[record.item_id] || 0}
                    onChange={e => {
                        const val = Number(e.target.value) || 0;
                        setDeliveredNowValues(prev => ({
                            ...prev,
                            [record.item_id]: Math.min(Math.max(0, val), record.ordered_quantity - record.received_quantity)
                        }));
                    }}
                    style={{ width: 80 }}
                />
            )
        },
        {
            title: 'Balance',
            key: 'balance',
            width: 100,
            render: (_: any, record: any) => {
                const deliveredNow = deliveredNowValues[record.item_id] || 0;
                const balance = Math.max(0, record.ordered_quantity - record.received_quantity - deliveredNow);
                return <Text className="text-[12px] text-slate-600">{balance}</Text>;
            }
        },
        {
            title: 'Comments',
            key: 'comments',
            width: 140,
            render: () => <Input size="small" placeholder="" style={{ width: 120 }} />
        }
    ];

    const tableData = po.items.map((item, idx) => {
        const inv = getInvItem(item.item_id);
        return {
            key: idx,
            item_id: item.item_id,
            sku: inv?.sku || `SKU${String(item.item_id).padStart(5, '0')}`,
            description: inv?.name || 'Item',
            ordered_quantity: item.ordered_quantity,
            received_quantity: item.received_quantity,
            units: inv?.unit_of_measure || 'Kg',
            currentStock: Number(inv?.current_stock || 0),
        };
    });


    return (
        <div style={{ maxWidth: '1536px', width: '100%', margin: '0 auto', paddingBottom: '40px' }}>
            {/* ─── Header bar matching CreatePurchaseOrderPage ─── */}
            <div className="bg-[#001529] text-white p-3 px-6 rounded-t-lg flex justify-between items-center mt-2 shadow-sm">
                <Space size="middle">
                    <Button type="text" icon={<LeftOutlined />} onClick={() => navigate(`/app/purchases/${po.id}`)} className="text-white hover:text-gray-200" />
                    <InboxOutlined style={{ fontSize: '18px' }} />
                    <Title level={4} style={{ margin: 0, color: 'white' }}>Inward Document</Title>
                </Space>
                <div className="flex items-center gap-4">
                    <Button type="text" className="text-white hover:text-gray-200"><QuestionCircleOutlined /></Button>
                    <Button
                        onClick={() => navigate(`/app/purchases/${po.id}`)}
                        icon={<CloseOutlined />}
                        danger
                        ghost
                        style={{
                            borderColor: '#ff4d4f',
                            color: '#ff7875',
                            borderRadius: 6,
                            fontWeight: 500,
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            </div>

            <Form form={form} layout="vertical" className="bg-[#f4f7f8] p-6 rounded-b-lg border border-gray-200 border-t-0">
                {/* ─── Top Cards Row matching CreatePurchaseOrderPage ─── */}
                <Row gutter={24}>
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card 
                                size="small" 
                                className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full" 
                                title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Goods Received By</div>} 
                                extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600" />} />} 
                                styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
                            >
                                <div className="mb-4">
                                    <Text strong className="text-[15px] text-slate-800">{currentUser?.full_name || currentUser?.username || 'System Administrator'}</Text>
                                    <div className="text-slate-500 text-[12px] mt-1">GSTIN: <span className="text-slate-700 font-medium">—</span></div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative">
                                    <Text className="text-slate-600 text-[13px] font-medium block mb-1">Billing Address</Text>
                                    <Text className="text-slate-500 text-[12px] leading-relaxed block">
                                        Main Address,<br/>
                                        Mumbai (Maharashtra)<br/>
                                        India - 400001
                                    </Text>
                                </div>
                            </Card>
                        </div>
                    </Col>
                    
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card 
                                size="small" 
                                className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full" 
                                title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Delivery Location</div>} 
                                extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600"/>} />} 
                                styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
                            >
                                <Text strong className="text-[14px] text-slate-800">Main</Text>
                                <Text className="text-slate-500 text-[12px] leading-relaxed block mt-2">
                                    Main Address,<br/>
                                    Mumbai (Maharashtra)<br/>
                                    India - 400001
                                </Text>
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <Text className="text-slate-500 text-[12px] font-medium">GSTIN : <span className="text-slate-400">—</span></Text>
                                </div>
                            </Card>
                        </div>
                    </Col>

                    <Col span={8}>
                        <Card 
                            size="small" 
                            className="border border-blue-100 shadow-[0_4px_12px_rgba(37,99,235,0.06)] rounded-xl bg-gradient-to-b from-white to-[#f8fafc] h-full overflow-hidden" 
                            title={<div className="text-blue-700 font-semibold text-[13px] uppercase tracking-wide">Primary Document Details</div>} 
                            extra={<Button type="text" size="small" className="text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm rounded-md px-2" onClick={() => setShowOptionalFields(!showOptionalFields)}>{showOptionalFields ? 'Hide Optional Fields' : 'Show Optional Fields'}</Button>} 
                            styles={{ header: { backgroundColor: '#f0f4f8', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px 20px' } }}
                        >
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Document Number <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}>
                                        <Input value={wrnNumber} readOnly className="rounded-lg border-blue-200 px-3 py-1.5 font-medium" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Document Date</span>} style={{ marginBottom: 20 }}>
                                        <DatePicker value={dayjs()} style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" disabled format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amendment</span>} style={{ marginBottom: 20 }}>
                                        <Input defaultValue="0" readOnly className="rounded-lg border-gray-300 py-1.5" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Delivery Date <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}>
                                        <DatePicker value={deliveryDate} onChange={(d) => d && setDeliveryDate(d)} style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">PO Number <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}>
                                        <Input value={po.po_number} readOnly className="rounded-lg border-gray-300 py-1.5" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">PO Date <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}>
                                        <DatePicker value={dayjs(po.order_date)} style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" disabled format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Store <span className="text-red-500">*</span></span>} style={{ marginBottom: 0 }}>
                                        <Select defaultValue="Default Stock Store" className="w-full text-slate-700 font-medium" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>
                
                {/* ─── Goods Sent By ─── */}
                <Card 
                    size="small" 
                    className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white mt-4" 
                    title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Goods Sent By</div>} 
                    extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600"/>} />} 
                    styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <Text strong className="text-[15px] text-slate-800">{supplier?.name || "Selected Supplier"}</Text>
                        <Text className="text-slate-700 font-medium text-[12px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                            GSTIN: {supplier?.gstin || "N/A"}
                        </Text>
                    </div>
                    <Text className="text-slate-500 text-[12px] leading-relaxed block">
                        {supplier?.address1 || "Address"}<br/>
                        {supplier?.city ? `${supplier.city}, ${supplier.state || ''}` : ""}<br/>
                        {supplier?.country || 'India'} - {supplier?.pincode || ''}
                    </Text>
                </Card>

                <Divider className="my-6" />

                {/* ─── Items Table Section ─── */}
                <div className="px-4">
                    <div className="mb-4 flex justify-between items-center">
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Download Item Template</Button>
                            <Button icon={<UploadOutlined />}>Bulk Upload</Button>
                        </Space>
                        <Space align="center" size="middle">
                            <Select 
                                mode="multiple" 
                                size="small" 
                                style={{ minWidth: 180 }} 
                                placeholder={<span><AppstoreAddOutlined /> Optional Columns</span>} 
                                value={selectedOptionalColumns} 
                                onChange={setSelectedOptionalColumns} 
                                options={[{ label: 'Remarks', value: 'remarks' }]} 
                                maxTagCount={1} 
                            />
                            <Input.Search placeholder="Search with Id or..." size="small" style={{ width: 160 }} />
                        </Space>
                    </div>

                    <Table 
                        columns={itemColumns} 
                        dataSource={tableData} 
                        pagination={false} 
                        size="small" 
                        className="mb-8 border border-gray-200" 
                        rowClassName={() => 'bg-white hover:bg-gray-50'} 
                        components={{ header: { cell: (props: any) => <th {...props} style={{ background: '#f0fdfa', color: '#0f766e', fontWeight: 600, fontSize: '13px' }} /> } }} 
                    />

                    {/* ─── Bottom Section: Tabs & Summary ─── */}
                    <Row gutter={32}>
                        <Col span={14}>
                            <DocumentTabsSection mode="create" value={documentTabsData} onChange={setDocumentTabsData} />
                        </Col>
                        <Col span={10}>
                            {/* Summary goes here if needed, keeping it empty for inward alignment but structured similarly */}
                            <div className="p-4 rounded-md">
                                <div className="flex justify-between items-center border-t border-gray-200 mt-auto pt-4">
                                    <Text className="text-gray-500 text-lg">Total Items Delivered Now :</Text>
                                    <Text strong className="text-xl">
                                        {Object.values(deliveredNowValues).reduce((sum, val) => sum + val, 0)}
                                    </Text>
                                </div>
                            </div>
                        </Col>
                    </Row>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                        <Button size="large" onClick={() => handleSave('draft')} loading={saving} className="px-8">SAVE DRAFT</Button>
                        <Button size="large" type="primary" onClick={() => handleSave('send')} loading={saving} className="px-8">SAVE AND SEND</Button>
                    </div>
                </div>
            </Form>

            <style>{`
                .custom-tabs .ant-tabs-nav::before { border-bottom: none; }
                .custom-tabs .ant-tabs-tab { background: #f8fafc; border-radius: 16px !important; border: 1px solid #e2e8f0 !important; margin-right: 8px !important; }
                .custom-tabs .ant-tabs-tab-active { background: #eff6ff !important; border-color: #bfdbfe !important; }
                .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1677ff !important; font-weight: 500; }
            `}</style>
        </div>
    );
}
