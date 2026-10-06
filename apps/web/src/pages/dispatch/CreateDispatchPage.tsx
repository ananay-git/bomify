import { useEffect, useState, useMemo } from 'react';
import {
    Card, Form, Input, DatePicker, Select, Button, Table, Typography,
    Row, Col, Space, Divider, message, InputNumber, Tag, Alert
} from 'antd';
import {
    DeleteOutlined, LeftOutlined, CloseOutlined,
    TruckOutlined, InboxOutlined, SaveOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { extractApiError } from '@/lib/errors';
import { dispatchApi, DispatchableSalesOrder, DispatchableSalesOrderItem } from '@/features/dispatch/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface DispatchLineItem {
    key: number;
    product_id: number;
    item_name: string;
    item_sku: string;
    item_uom: string;
    ordered_quantity: number;
    already_dispatched: number;
    remaining_quantity: number;
    available_stock: number;
    dispatch_quantity: number;
}

const LOGISTICS_PARTNERS = [
    'Delhivery', 'BlueDart', 'DTDC', 'FedEx', 'Ecom Express',
    'Shiprocket', 'XpressBees', 'Shadowfax', 'Self-Delivery', 'Other'
];

export default function CreateDispatchPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [form] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [salesOrders, setSalesOrders] = useState<DispatchableSalesOrder[]>([]);
    const [loadingSOs, setLoadingSOs] = useState(true);
    const [selectedSO, setSelectedSO] = useState<DispatchableSalesOrder | null>(null);
    const [nextDispatchNumber, setNextDispatchNumber] = useState<string>('');
    const [items, setItems] = useState<DispatchLineItem[]>([]);

    // Fetch dispatchable sales orders
    useEffect(() => {
        const loadSOs = async () => {
            setLoadingSOs(true);
            try {
                const orders = await dispatchApi.getDispatchableSalesOrders();
                setSalesOrders(orders);
            } catch { message.error('Failed to load sales orders'); }
            finally { setLoadingSOs(false); }
        };
        loadSOs();
    }, []);

    // Auto-select sales order or load production item from URL query parameter
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const soIdParam = queryParams.get('so_id');
        const processIdParam = queryParams.get('process_id');

        if (soIdParam && salesOrders.length > 0 && !selectedSO) {
            handleSOSelect(parseInt(soIdParam, 10));
        } else if (processIdParam && items.length === 0) {
            // Fetch production ready items to pre-fill direct dispatch
            dispatchApi.getProductionReadyItems().then(data => {
                const match = data.find(p => p.process_id === parseInt(processIdParam, 10));
                if (match) {
                    setItems([{
                        key: match.process_id,
                        product_id: match.fg_item_id,
                        item_name: match.fg_name,
                        item_sku: match.fg_sku,
                        item_uom: 'Units',
                        ordered_quantity: match.completed_quantity,
                        already_dispatched: 0,
                        remaining_quantity: match.completed_quantity,
                        available_stock: match.available_stock,
                        dispatch_quantity: match.completed_quantity,
                    }]);
                }
            }).catch(() => message.error('Failed to load production item'));
        }
    }, [location.search, salesOrders]); // eslint-disable-line react-hooks/exhaustive-deps


    // Get next dispatch number
    useEffect(() => {
        dispatchApi.getNextNumber()
            .then(num => setNextDispatchNumber(num))
            .catch(() => setNextDispatchNumber(`DSP-${new Date().getFullYear()}-0001`));
    }, []);

    const handleSOSelect = (soId: number) => {
        const so = salesOrders.find(s => s.id === soId);
        setSelectedSO(so || null);
        form.setFieldsValue({ sales_order_id: soId });

        if (so) {
            setItems(so.items
                .filter((item: DispatchableSalesOrderItem) => item.remaining_quantity > 0)
                .map((item: DispatchableSalesOrderItem, idx: number) => ({
                    key: idx,
                    product_id: item.item_id,
                    item_name: item.item_name || `Item #${item.item_id}`,
                    item_sku: item.item_sku || '',
                    item_uom: item.item_uom || '',
                    ordered_quantity: item.ordered_quantity,
                    already_dispatched: item.already_dispatched,
                    remaining_quantity: item.remaining_quantity,
                    available_stock: item.available_stock || 0,
                    dispatch_quantity: item.remaining_quantity, // Default to remaining
                }))
            );
        } else {
            setItems([]);
        }
    };

    const handleQuantityChange = (key: number, value: number | null) => {
        setItems(prev => prev.map(item =>
            item.key === key ? { ...item, dispatch_quantity: value || 0 } : item
        ));
    };

    const handleRemoveItem = (key: number) => {
        setItems(prev => prev.filter(item => item.key !== key));
    };

    const totalDispatchItems = useMemo(() => {
        return items.filter(i => i.dispatch_quantity > 0).length;
    }, [items]);

    const totalDispatchQty = useMemo(() => {
        return items.reduce((s, i) => s + i.dispatch_quantity, 0);
    }, [items]);

    const handleSave = async (asDraft: boolean) => {
        try {
            setLoading(true);
            const values = await form.validateFields();
            const validItems = items.filter(i => i.dispatch_quantity > 0);

            if (validItems.length === 0) {
                message.error('Please set quantity for at least one item');
                setLoading(false);
                return;
            }

            // Validate quantities
            for (const item of validItems) {
                if (item.dispatch_quantity > item.remaining_quantity) {
                    message.error(`Cannot dispatch more than remaining for ${item.item_name}`);
                    setLoading(false);
                    return;
                }
                if (item.dispatch_quantity > item.available_stock) {
                    message.error(`Insufficient stock for ${item.item_name} (Available: ${item.available_stock})`);
                    setLoading(false);
                    return;
                }
            }

            const result = await dispatchApi.create({
                sales_order_id: values.sales_order_id || null,
                production_process_id: searchParams.get('process_id') ? parseInt(searchParams.get('process_id')!) : null,
                dispatch_date: values.dispatch_date ? values.dispatch_date.toISOString() : undefined,
                expected_delivery: values.expected_delivery ? values.expected_delivery.toISOString() : null,
                logistics_partner: values.logistics_partner || null,
                vehicle_details: values.vehicle_details || null,
                driver_name: values.driver_name || null,
                driver_phone: values.driver_phone || null,
                notes: values.notes || null,
                items: validItems.map(i => ({
                    product_id: i.product_id,
                    quantity: i.dispatch_quantity,
                })),
            });

            if (!asDraft) {
                // Auto-pack
                try {
                    await dispatchApi.pack(result.id);
                    message.success('Dispatch created and packed! Inventory deducted.');
                } catch (packErr) {
                    message.warning('Dispatch saved as Draft. ' + extractApiError(packErr, 'Could not auto-pack.'));
                }
            } else {
                message.success('Dispatch saved as Draft');
            }
            navigate(`/app/dispatch/${result.id}`);
        } catch (error) {
            console.error('Error:', error);
            message.error(extractApiError(error, 'Please check required fields and try again.'));
        } finally { setLoading(false); }
    };

    const itemColumns = [
        {
            title: 'Product', key: 'product', width: 220,
            render: (_: unknown, record: DispatchLineItem) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>{record.item_name}</Text><br />
                    <Text type="secondary" style={{ fontSize: 11 }}>SKU: {record.item_sku}</Text>
                </div>
            )
        },
        {
            title: 'UOM', dataIndex: 'item_uom', key: 'item_uom', width: 80,
            render: (text: string) => <Text style={{ fontSize: 13 }}>{text || '-'}</Text>
        },
        {
            title: 'Ordered', dataIndex: 'ordered_quantity', key: 'ordered_quantity', width: 90,
            render: (val: number) => <Text style={{ fontSize: 13 }}>{val}</Text>
        },
        {
            title: 'Already Dispatched', dataIndex: 'already_dispatched', key: 'already_dispatched', width: 130,
            render: (val: number) => (
                <Text style={{ fontSize: 13, color: val > 0 ? '#fa8c16' : '#8c8c8c' }}>
                    {val}
                </Text>
            )
        },
        {
            title: 'Remaining', dataIndex: 'remaining_quantity', key: 'remaining_quantity', width: 100,
            render: (val: number) => <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{val}</Text>
        },
        {
            title: 'Stock', dataIndex: 'available_stock', key: 'available_stock', width: 80,
            render: (val: number, record: DispatchLineItem) => {
                const isLow = val < record.dispatch_quantity;
                return <Text style={{ color: isLow ? '#ff4d4f' : '#52c41a', fontWeight: 600, fontSize: 13 }}>{val}</Text>;
            }
        },
        {
            title: 'Dispatch Qty', key: 'dispatch_quantity', width: 120,
            render: (_: unknown, record: DispatchLineItem) => (
                <InputNumber
                    min={0}
                    max={record.remaining_quantity}
                    value={record.dispatch_quantity}
                    onChange={(val) => handleQuantityChange(record.key, val)}
                    style={{ width: 100 }}
                    status={record.dispatch_quantity > record.available_stock ? 'error' : undefined}
                />
            )
        },
        {
            title: '', key: 'action', width: 50,
            render: (_: unknown, record: DispatchLineItem) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
            )
        },
    ];

    return (
        <div style={{ maxWidth: '1536px', width: '100%', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div className="bg-[#001529] text-white p-3 px-6 rounded-t-lg flex justify-between items-center mt-2 shadow-sm">
                <Space size="middle">
                    <Button type="text" icon={<LeftOutlined />} onClick={() => navigate('/app/dispatch')} className="text-white hover:text-gray-200" />
                    <TruckOutlined style={{ fontSize: '18px' }} />
                    <Title level={4} style={{ margin: 0, color: 'white' }}>Create Dispatch</Title>
                    <Tag color="blue" style={{ borderRadius: 12 }}>{nextDispatchNumber}</Tag>
                </Space>
                <div className="flex items-center gap-4">
                    <Button onClick={() => navigate('/app/dispatch')} icon={<CloseOutlined />} danger ghost
                        style={{ borderColor: '#ff4d4f', color: '#ff7875', borderRadius: 6, fontWeight: 500 }}>
                        Cancel
                    </Button>
                </div>
            </div>

            <Form form={form} layout="vertical" className="bg-[#f4f7f8] p-6 rounded-b-lg border border-gray-200 border-t-0">
                {/* Top Section */}
                <Row gutter={24}>
                    {/* Sales Order Selection */}
                    <Col span={8}>
                        <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full"
                            title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Sales Order (Optional)</div>}
                            styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                            <Form.Item name="sales_order_id" label={<span className="text-xs font-medium text-slate-500 uppercase">Select Order</span>}
                                style={{ marginBottom: 16 }}>
                                <Select showSearch placeholder="Search orders..." loading={loadingSOs}
                                    onChange={handleSOSelect} optionFilterProp="label"
                                    options={salesOrders.map(so => ({
                                        value: so.id,
                                        label: `${so.order_number} — ${so.customer_name || 'Customer'} (₹${so.total_amount?.toLocaleString('en-IN') || '0'})`
                                    }))} />
                            </Form.Item>
                            {selectedSO && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                    <Text strong className="text-[14px] text-slate-800 block mb-1">{selectedSO.order_number}</Text>
                                    <div className="text-slate-500 text-[12px] mb-1">Customer: <span className="text-slate-700 font-medium">{selectedSO.customer_name || 'N/A'}</span></div>
                                    <div className="text-slate-500 text-[12px] mb-1">Status: <Tag color="green" style={{ borderRadius: 12, fontSize: 10 }}>{selectedSO.status.toUpperCase()}</Tag></div>
                                    {selectedSO.total_amount && (
                                        <div className="text-slate-500 text-[12px]">Amount: <span className="text-teal-700 font-semibold">₹{selectedSO.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                    )}
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Logistics Details */}
                    <Col span={8}>
                        <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full"
                            title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Logistics Details</div>}
                            styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                            <Form.Item name="logistics_partner" label={<span className="text-xs font-medium text-slate-500 uppercase">Logistics Partner</span>} style={{ marginBottom: 12 }}>
                                <Select placeholder="Select partner" allowClear>
                                    {LOGISTICS_PARTNERS.map(p => <Option key={p} value={p}>{p}</Option>)}
                                </Select>
                            </Form.Item>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="driver_name" label={<span className="text-xs font-medium text-slate-500 uppercase">Driver Name</span>} style={{ marginBottom: 12 }}>
                                        <Input placeholder="Driver name" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="driver_phone" label={<span className="text-xs font-medium text-slate-500 uppercase">Driver Phone</span>} style={{ marginBottom: 12 }}>
                                        <Input placeholder="+91..." />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="vehicle_details" label={<span className="text-xs font-medium text-slate-500 uppercase">Vehicle Details</span>} style={{ marginBottom: 0 }}>
                                <Input placeholder="Vehicle number / type" />
                            </Form.Item>
                        </Card>
                    </Col>

                    {/* Document Details */}
                    <Col span={8}>
                        <Card size="small" className="border border-blue-100 shadow-[0_4px_12px_rgba(37,99,235,0.06)] rounded-xl bg-gradient-to-b from-white to-[#f8fafc] h-full overflow-hidden"
                            title={<div className="text-blue-700 font-semibold text-[13px] uppercase tracking-wide">Document Details</div>}
                            styles={{ header: { backgroundColor: '#f0f4f8', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px 20px' } }}>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Dispatch #</span>} style={{ marginBottom: 20 }}>
                                        <Input value={nextDispatchNumber} disabled className="rounded-lg border-blue-200 px-3 py-1.5 font-medium" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="dispatch_date" label={<span className="text-xs font-medium text-slate-500 uppercase">Dispatch Date</span>} style={{ marginBottom: 20 }} initialValue={dayjs()}>
                                        <DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="expected_delivery" label={<span className="text-xs font-medium text-slate-500 uppercase">Expected Delivery</span>} style={{ marginBottom: 20 }}>
                                <DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5"
                                    disabledDate={(current) => current && current < dayjs().startOf('day')} format="DD/MM/YYYY" />
                            </Form.Item>
                            <Form.Item name="notes" label={<span className="text-xs font-medium text-slate-500 uppercase">Notes</span>} style={{ marginBottom: 0 }}>
                                <TextArea rows={2} placeholder="Delivery instructions..." />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>

                <Divider className="my-6" />

                {/* Items Table Section */}
                <div className="px-4">
                    {items.length > 0 ? (
                        <>
                            <div className="mb-4 flex justify-between items-center">
                                <Text strong style={{ fontSize: 14, color: '#262626' }}>
                                    <InboxOutlined style={{ marginRight: 8 }} />
                                    Items to Dispatch
                                </Text>
                                <Space>
                                    <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>
                                        {totalDispatchItems} items
                                    </Tag>
                                    <Tag color="geekblue" style={{ borderRadius: 12, fontWeight: 600 }}>
                                        Total qty: {totalDispatchQty}
                                    </Tag>
                                </Space>
                            </div>

                            <Table
                                columns={itemColumns}
                                dataSource={items}
                                pagination={false}
                                size="small"
                                className="mb-4 border border-gray-200"
                                scroll={{ x: 'max-content' }}
                                rowClassName={() => 'bg-white hover:bg-gray-50'}
                                components={{
                                    header: {
                                        cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                                            <th {...props} style={{ background: '#f0fdfa', color: '#0f766e', fontWeight: 600, fontSize: '13px' }} />
                                        )
                                    }
                                }}
                            />
                        </>
                    ) : (
                        <Alert
                            title="No Items Selected"
                            description="Choose a confirmed sales order above, or link a direct production process to load items for dispatch."
                            type="info"
                            showIcon
                            style={{ borderRadius: 8, marginBottom: 24 }}
                        />
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                        <Button size="large" onClick={() => navigate('/app/dispatch')} className="px-8">CANCEL</Button>
                        <Button size="large" icon={<SaveOutlined />} onClick={() => handleSave(true)} loading={loading} className="px-8">
                            SAVE AS DRAFT
                        </Button>
                        <Button size="large" type="primary" icon={<InboxOutlined />} onClick={() => handleSave(false)} loading={loading} className="px-8"
                            style={{ background: '#fa8c16', borderColor: '#fa8c16' }}>
                            SAVE & PACK
                        </Button>
                    </div>
                </div>
            </Form>
        </div>
    );
}
