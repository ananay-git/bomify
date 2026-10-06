import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Card, Form, Input, DatePicker, Select, Button, Table, Typography,
    Row, Col, Space, Divider, Tabs, Tag, message
} from 'antd';
import {
    DeleteOutlined, QuestionCircleOutlined, FormOutlined,
    LeftOutlined, PlusOutlined, CloseOutlined, DownloadOutlined,
    UploadOutlined
} from '@ant-design/icons';
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import { useNavigate } from 'react-router-dom';
import { extractApiError } from '@/lib/errors';
import { fetchParties, Party } from '@/features/parties/api/parties';
import { salesApi } from '@/features/sales/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import AddItemModal from '@/features/inventory/components/AddItemModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface SOLineItem {
    key: number;
    itemId: number | null;
    description: string;
    hsn: string;
    quantity: number;
    units: string;
    currentStock: number;
    price: number;
    tax: number;
    discount: number;
    inventoryItemData?: InventoryItem;
}

export default function CreateSalesOrderPage() {
    const navigate = useNavigate();
    const [form] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Party[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<Party | null>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [addItemModalOpen, setAddItemModalOpen] = useState(false);
    const [nextOrderNumber, setNextOrderNumber] = useState<string>('');
    const [priceType, setPriceType] = useState<string>('default');
    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);

    const [items, setItems] = useState<SOLineItem[]>([{
        key: 1, itemId: null, description: '', hsn: '', quantity: 0,
        units: '', currentStock: 0, price: 0, tax: 0, discount: 0,
    }]);

    // Fetch customers (parties with type customer or both)
    useEffect(() => {
        const loadCustomers = async () => {
            setLoadingCustomers(true);
            try {
                const [customerData, bothData] = await Promise.all([
                    fetchParties('customer'),
                    fetchParties('both'),
                ]);
                setCustomers([...customerData.parties, ...bothData.parties]);
            } catch { message.error('Failed to load customers'); }
            finally { setLoadingCustomers(false); }
        };
        loadCustomers();
    }, []);

    // Fetch inventory items (sellable)
    const fetchInventoryItems = useCallback(async () => {
        try {
            const data = await inventoryApi.getAll();
            // Filter to items that can be sold
            setInventoryItems(data.items.filter(i =>
                i.buy_sell === 'sell' || i.buy_sell === 'both'
            ));
        } catch { console.error('Failed to load inventory items'); }
    }, []);

    useEffect(() => { fetchInventoryItems(); }, [fetchInventoryItems]);

    // Get next order number
    useEffect(() => {
        salesApi.getNextNumber()
            .then(num => setNextOrderNumber(num))
            .catch(() => setNextOrderNumber(`SO-${new Date().getFullYear()}-0001`));
    }, []);

    const getItemPrice = useCallback((item: InventoryItem) => {
        if (priceType === 'regular') return Number(item.regular_selling_price) || Number(item.default_price) || 0;
        if (priceType === 'wholesale') return Number(item.wholesale_selling_price) || Number(item.default_price) || 0;
        return Number(item.default_price) || 0;
    }, [priceType]);

    // When price type changes, update existing items
    useEffect(() => {
        setItems(prev => prev.map(item => {
            if (!item.inventoryItemData) return item;
            return { ...item, price: getItemPrice(item.inventoryItemData) };
        }));
    }, [priceType, getItemPrice]);

    const getLineNetAmount = useCallback((item: SOLineItem) => {
        const gross = item.quantity * item.price;
        return gross * (1 - (item.discount || 0) / 100);
    }, []);

    const calculations = useMemo(() => {
        const validItems = items.filter(i => i.itemId && i.quantity > 0);
        const totalBeforeTax = validItems.reduce((sum, i) => sum + getLineNetAmount(i), 0);
        const totalTax = validItems.reduce((sum, i) => sum + (getLineNetAmount(i) * (i.tax / 100)), 0);
        const totalDiscount = validItems.reduce((sum, i) => sum + (i.quantity * i.price) - getLineNetAmount(i), 0);

        let extraChargesTotal = 0;
        let extraChargesTax = 0;
        documentTabsData.extra_charges.forEach(c => {
            extraChargesTotal += c.amount;
            extraChargesTax += c.amount * (c.tax_rate / 100);
        });

        const grandTotal = totalBeforeTax + totalTax + extraChargesTotal + extraChargesTax;
        
        return { 
            totalBeforeTax, 
            totalTax: totalTax + extraChargesTax, 
            totalDiscount, 
            extraChargesTotal,
            grandTotal 
        };
    }, [items, getLineNetAmount, documentTabsData.extra_charges]);

    const handleCustomerSelect = (customerId: number) => {
        const customer = customers.find(c => c.id === customerId);
        setSelectedCustomer(customer || null);
        form.setFieldsValue({ customer_id: customerId });
    };

    const handleItemSelect = (key: number, inventoryItemId: number | null) => {
        if (inventoryItemId === -1) { setAddItemModalOpen(true); return; }
        setItems(prev => prev.map(item => {
            if (item.key !== key) return item;
            if (!inventoryItemId) return {
                ...item, itemId: null, description: '', hsn: '', units: '',
                currentStock: 0, price: 0, tax: 0, discount: 0, inventoryItemData: undefined
            };
            const invItem = inventoryItems.find(i => i.id === inventoryItemId);
            if (!invItem) return item;
            return {
                ...item, itemId: invItem.id, description: invItem.name,
                hsn: invItem.hsn_code || '', units: invItem.unit_of_measure,
                currentStock: Number(invItem.current_stock),
                price: getItemPrice(invItem), tax: Number(invItem.tax) || 0,
                discount: 0, inventoryItemData: invItem,
            };
        }));
    };

    const handleFieldChange = (key: number, field: string, value: unknown) => {
        setItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
    };

    const handleAddItem = () => {
        setItems([...items, {
            key: Date.now(), itemId: null, description: '', hsn: '',
            quantity: 0, units: '', currentStock: 0, price: 0, tax: 0, discount: 0,
        }]);
    };

    const handleRemoveItem = (key: number) => { setItems(items.filter(item => item.key !== key)); };

    const handleSave = async (asDraft: boolean) => {
        try {
            setLoading(true);
            const values = await form.validateFields();
            const validItems = items.filter(i => i.itemId && i.quantity > 0);
            if (validItems.length === 0) {
                message.error('Please add at least one item with quantity');
                setLoading(false);
                return;
            }

            const result = await salesApi.create({
                customer_id: values.customer_id,
                expected_delivery_date: values.expected_delivery ? values.expected_delivery.toISOString() : null,
                payment_terms: values.payment_terms || null,
                billing_address: selectedCustomer ? {
                    address: selectedCustomer.address || '',
                    city: selectedCustomer.city || '',
                    state: selectedCustomer.state || '',
                    pincode: selectedCustomer.pincode || '',
                } : null,
                shipping_address: values.shipping_same ? null : null,
                notes: values.notes || null,
                items: validItems.map(i => ({
                    item_id: i.itemId!,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.price,
                    discount: i.discount || 0,
                    tax_rate: i.tax || 0,
                })),
                // Document tab fields
                extra_charges: documentTabsData.extra_charges.length > 0 ? documentTabsData.extra_charges : null,
                terms_conditions: documentTabsData.terms_conditions || null,
                comments: documentTabsData.comments.length > 0 ? documentTabsData.comments : null,
                additional_details: documentTabsData.additional_details.length > 0 ? documentTabsData.additional_details : null,
                signature_data: documentTabsData.signature_data || null,
                attachments: documentTabsData.attachments.length > 0 ? documentTabsData.attachments : null,
            });

            if (!asDraft) {
                // Auto-confirm
                try {
                    await salesApi.confirm(result.id);
                    message.success('Sales Order created and confirmed!');
                } catch (confirmErr) {
                    message.warning('Order created as Draft. ' + extractApiError(confirmErr, 'Could not auto-confirm.'));
                }
                navigate(`/app/sales/${result.id}`);
            } else {
                message.success('Sales Order saved as Draft');
                navigate(`/app/sales/${result.id}`);
            }
        } catch (error) {
            console.error('Error:', error);
            message.error(extractApiError(error, 'Please check required fields and try again.'));
        } finally { setLoading(false); }
    };

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const itemDropdownOptions = [
        { value: -1, label: <span style={{ color: '#1677ff', fontWeight: 600 }}><PlusOutlined /> Add New Item</span> },
        ...inventoryItems.map(inv => ({ value: inv.id, label: `${inv.sku} - ${inv.name}` }))
    ];

    const taxOptions = [
        { value: 0, label: 'None (0%)' }, { value: 5, label: 'GST 5%' },
        { value: 12, label: 'GST 12%' }, { value: 18, label: 'GST 18%' }, { value: 28, label: 'GST 28%' }
    ];

    const unitOptions = ['Kg', 'g', 'Liter', 'ml', 'Meter', 'cm', 'Piece', 'Box', 'Dozen', 'Ton', 'Bag', 'Roll'].map(u => ({ value: u, label: u }));

    const discountOptions = [
        { value: 0, label: 'None (0%)' }, { value: 2, label: '2%' }, { value: 5, label: '5%' },
        { value: 8, label: '8%' }, { value: 10, label: '10%' }, { value: 12, label: '12%' },
        { value: 15, label: '15%' }, { value: 20, label: '20%' }, { value: 25, label: '25%' },
    ];

    const itemColumns = [
        {
            title: 'Item', dataIndex: 'itemId', key: 'itemId', width: 220,
            render: (_: unknown, record: SOLineItem) => (
                <Select style={{ width: 200 }} placeholder="Select product" value={record.itemId}
                    onChange={(val) => handleItemSelect(record.key, val)} options={itemDropdownOptions}
                    showSearch optionFilterProp="label" allowClear onClear={() => handleItemSelect(record.key, null)} />
            )
        },
        {
            title: 'Description', dataIndex: 'description', key: 'description',
            render: (_: unknown, record: SOLineItem) => (
                <Input value={record.description} onChange={e => handleFieldChange(record.key, 'description', e.target.value)} placeholder="Description" />
            )
        },
        {
            title: 'HSN', dataIndex: 'hsn', key: 'hsn', width: 100,
            render: (_: unknown, record: SOLineItem) => (
                <Input style={{ width: 90 }} value={record.hsn} onChange={e => handleFieldChange(record.key, 'hsn', e.target.value)} />
            )
        },
        {
            title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 90,
            render: (_: unknown, record: SOLineItem) => (
                <Input type="number" value={record.quantity} onChange={e => handleFieldChange(record.key, 'quantity', Number(e.target.value))} style={{ width: 80 }} />
            )
        },
        {
            title: 'Units', dataIndex: 'units', key: 'units', width: 100,
            render: (_: unknown, record: SOLineItem) => (
                <Select style={{ width: 90 }} value={record.units || undefined} onChange={val => handleFieldChange(record.key, 'units', val)} placeholder="Unit" options={unitOptions} />
            )
        },
        {
            title: 'Stock', dataIndex: 'currentStock', key: 'currentStock', width: 80,
            render: (_: unknown, record: SOLineItem) => {
                const isLow = record.currentStock > 0 && record.quantity > record.currentStock;
                return <Text style={{ color: isLow ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{record.currentStock || '-'}</Text>;
            }
        },
        {
            title: priceType === 'regular' ? 'Price (Reg)' : priceType === 'wholesale' ? 'Price (WS)' : 'Price',
            dataIndex: 'price', key: 'price', width: 120,
            render: (_: unknown, record: SOLineItem) => (
                <Input type="number" value={record.price} onChange={e => handleFieldChange(record.key, 'price', Number(e.target.value))} style={{ width: 100 }} />
            )
        },
        {
            title: 'Tax', dataIndex: 'tax', key: 'tax', width: 110,
            render: (_: unknown, record: SOLineItem) => (
                <Select style={{ width: 100 }} value={record.tax} onChange={val => handleFieldChange(record.key, 'tax', val)} options={taxOptions} />
            )
        },
        {
            title: 'Disc %', dataIndex: 'discount', key: 'discount', width: 110,
            render: (_: unknown, record: SOLineItem) => (
                <Select style={{ width: 100 }} value={record.discount} onChange={val => handleFieldChange(record.key, 'discount', val)} options={discountOptions} />
            )
        },
        {
            title: 'Amount', key: 'amount', width: 120,
            render: (_: unknown, record: SOLineItem) => {
                const net = getLineNetAmount(record);
                const tax = net * (record.tax / 100);
                return <Text strong style={{ color: '#0f766e' }}>{formatCurrency(net + tax)}</Text>;
            }
        },
        {
            title: '', key: 'action', width: 50,
            render: (_: unknown, record: SOLineItem) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
            )
        },
    ];


    return (
        <div style={{ maxWidth: '1536px', width: '100%', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div className="bg-[#001529] text-white p-3 px-6 rounded-t-lg flex justify-between items-center mt-2 shadow-sm">
                <Space size="middle">
                    <Button type="text" icon={<LeftOutlined />} onClick={() => navigate('/app/sales')} className="text-white hover:text-gray-200" />
                    <FormOutlined style={{ fontSize: '18px' }} />
                    <Title level={4} style={{ margin: 0, color: 'white' }}>Sales Order</Title>
                    <Tag color="blue" style={{ borderRadius: 12 }}>{nextOrderNumber}</Tag>
                </Space>
                <div className="flex items-center gap-4">
                    <Select defaultValue="INR" style={{ width: 90 }} popupMatchSelectWidth={false}>
                        <Option value="INR">INR - ₹</Option><Option value="USD">USD - $</Option>
                    </Select>
                    <Button type="text" className="text-white hover:text-gray-200"><QuestionCircleOutlined /></Button>
                    <Button onClick={() => navigate('/app/sales')} icon={<CloseOutlined />} danger ghost
                        style={{ borderColor: '#ff4d4f', color: '#ff7875', borderRadius: 6, fontWeight: 500 }}>
                        Cancel
                    </Button>
                </div>
            </div>

            <Form form={form} layout="vertical" className="bg-[#f4f7f8] p-6 rounded-b-lg border border-gray-200 border-t-0">
                {/* Top Section */}
                <Row gutter={24}>
                    {/* Buyer Selection Card */}
                    <Col span={8}>
                        <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full"
                            title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Buyer Details</div>}
                            styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                            <Form.Item name="customer_id" label={<span className="text-xs font-medium text-slate-500 uppercase">Select Buyer <span className="text-red-500">*</span></span>}
                                rules={[{ required: true, message: 'Please select a buyer' }]} style={{ marginBottom: 16 }}>
                                <Select showSearch placeholder="Search buyers..." loading={loadingCustomers}
                                    onChange={handleCustomerSelect} optionFilterProp="label"
                                    options={customers.map(c => ({ value: c.id, label: `${c.name}${c.gstin ? ` (${c.gstin})` : ''}` }))} />
                            </Form.Item>
                            {selectedCustomer && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                    <Text strong className="text-[14px] text-slate-800 block mb-1">{selectedCustomer.name}</Text>
                                    {selectedCustomer.gstin && (
                                        <div className="text-slate-500 text-[12px] mb-2">GSTIN: <span className="text-slate-700 font-medium">{selectedCustomer.gstin}</span></div>
                                    )}
                                    <Text className="text-slate-500 text-[12px] leading-relaxed block">
                                        {selectedCustomer.address || ''}<br />
                                        {selectedCustomer.city ? `${selectedCustomer.city}, ${selectedCustomer.state || ''}` : ''}<br />
                                        India - {selectedCustomer.pincode || ''}
                                    </Text>
                                    {selectedCustomer.email && <div className="text-slate-500 text-[11px] mt-2">✉ {selectedCustomer.email}</div>}
                                    {selectedCustomer.phone && <div className="text-slate-500 text-[11px]">☎ {selectedCustomer.phone}</div>}
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Shipping Address Card */}
                    <Col span={8}>
                        <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white h-full"
                            title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Shipping Details</div>}
                            styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                            <Form.Item name="shipping_same" valuePropName="checked" initialValue={true} style={{ marginBottom: 12 }}>
                                <Select defaultValue="same" style={{ width: '100%' }} options={[
                                    { value: 'same', label: 'Same as Buyer Address' },
                                    { value: 'custom', label: 'Custom Shipping Address' },
                                ]} />
                            </Form.Item>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-2">
                                <Text className="text-slate-500 text-[12px] leading-relaxed block">
                                    {selectedCustomer ? (
                                        <>
                                            {selectedCustomer.address || 'Buyer address'}<br />
                                            {selectedCustomer.city || 'City'}, {selectedCustomer.state || 'State'}<br />
                                            India - {selectedCustomer.pincode || ''}
                                        </>
                                    ) : (
                                        'Select a buyer to populate shipping address'
                                    )}
                                </Text>
                            </div>
                        </Card>
                    </Col>

                    {/* Document Details Card */}
                    <Col span={8}>
                        <Card size="small" className="border border-blue-100 shadow-[0_4px_12px_rgba(37,99,235,0.06)] rounded-xl bg-gradient-to-b from-white to-[#f8fafc] h-full overflow-hidden"
                            title={<div className="text-blue-700 font-semibold text-[13px] uppercase tracking-wide">Document Details</div>}
                            styles={{ header: { backgroundColor: '#f0f4f8', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px 20px' } }}>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">SO Number</span>} style={{ marginBottom: 20 }}>
                                        <Input value={nextOrderNumber} disabled className="rounded-lg border-blue-200 px-3 py-1.5 font-medium" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase">Order Date</span>} style={{ marginBottom: 20 }} initialValue={dayjs()}>
                                        <DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" disabled format="DD/MM/YYYY" defaultValue={dayjs()} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item name="expected_delivery" label={<span className="text-xs font-medium text-slate-500 uppercase">Delivery Date <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}>
                                        <DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5"
                                            disabledDate={(current) => current && current < dayjs().startOf('day')} format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="payment_terms" label={<span className="text-xs font-medium text-slate-500 uppercase">Payment Terms</span>} style={{ marginBottom: 20 }}>
                                        <Select placeholder="Select" options={[
                                            { value: 'Immediate', label: 'Immediate' },
                                            { value: 'Net 15', label: 'Net 15' },
                                            { value: 'Net 30', label: 'Net 30' },
                                            { value: 'Net 60', label: 'Net 60' },
                                            { value: 'COD', label: 'Cash on Delivery' },
                                        ]} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>

                <Divider className="my-6" />

                {/* Items Table Section */}
                <div className="px-4">
                    <div className="mb-4 flex justify-between items-center">
                        <Space>
                            <Button icon={<DownloadOutlined />}>Download Template</Button>
                            <Button icon={<UploadOutlined />}>Bulk Upload</Button>
                        </Space>
                        <Space align="center" size="middle">
                            <div className="flex items-center gap-2">
                                <Text className="text-xs font-medium text-slate-500">Price type</Text>
                                <Select value={priceType} onChange={setPriceType} size="small" style={{ width: 180 }}
                                    options={[
                                        { value: 'default', label: 'Default Price' },
                                        { value: 'regular', label: 'Regular Selling Price' },
                                        { value: 'wholesale', label: 'Wholesale Selling Price' },
                                    ]} />
                            </div>
                            <Input.Search placeholder="Search item..." size="small" style={{ width: 160 }} />
                        </Space>
                    </div>

                    <Table columns={itemColumns} dataSource={items} pagination={false} size="small"
                        className="mb-4 border border-gray-200" scroll={{ x: 'max-content' }}
                        rowClassName={() => 'bg-white hover:bg-gray-50'}
                        components={{ header: { cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => <th {...props} style={{ background: '#f0fdfa', color: '#0f766e', fontWeight: 600, fontSize: '13px' }} /> } }} />
                    <Button type="primary" onClick={handleAddItem} className="mb-8" style={{ marginLeft: 0 }}>+ ADD ITEM</Button>

                    {/* Bottom Section: Tabs & Summary */}
                    <Row gutter={32}>
                        <Col span={14}>
                            <DocumentTabsSection
                                mode="create"
                                value={documentTabsData}
                                onChange={setDocumentTabsData}
                            />
                        </Col>
                        <Col span={10}>
                            <div className="p-4 rounded-md">
                                {calculations.totalDiscount > 0 && (
                                    <div className="flex justify-between mb-2">
                                        <Text className="text-orange-500">Item Discounts :</Text>
                                        <Text strong className="text-orange-500">- {formatCurrency(calculations.totalDiscount)}</Text>
                                    </div>
                                )}
                                <div className="flex justify-between mb-2">
                                    <Text className="text-gray-500">Total (before tax) :</Text>
                                    <Text strong>{formatCurrency(calculations.totalBeforeTax)}</Text>
                                </div>
                                {calculations.extraChargesTotal > 0 && (
                                    <div className="flex justify-between mb-2">
                                        <Text className="text-gray-500">Extra Charges :</Text>
                                        <Text strong>{formatCurrency(calculations.extraChargesTotal)}</Text>
                                    </div>
                                )}
                                <div className="flex justify-between mb-3">
                                    <Text className="text-gray-500">Total Tax (GST) :</Text>
                                    <Text strong>{formatCurrency(calculations.totalTax)}</Text>
                                </div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div className="flex justify-between mb-4">
                                    <Text strong className="text-base">Grand Total :</Text>
                                    <Text strong className="text-lg" style={{ color: '#0f766e' }}>{formatCurrency(calculations.grandTotal)}</Text>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                        <Button size="large" onClick={() => navigate('/app/sales')} className="px-8">CANCEL</Button>
                        <Button size="large" onClick={() => handleSave(true)} loading={loading} className="px-8">SAVE AS DRAFT</Button>
                        <Button size="large" type="primary" onClick={() => handleSave(false)} loading={loading} className="px-8"
                            style={{ background: '#0f766e', borderColor: '#0f766e' }}>
                            CONFIRM ORDER
                        </Button>
                    </div>
                </div>
            </Form>

            {/* Modals */}
            <AddItemModal open={addItemModalOpen} onClose={() => setAddItemModalOpen(false)}
                onSuccess={() => { fetchInventoryItems(); setAddItemModalOpen(false); }} />

            <style>{`
                .custom-tabs .ant-tabs-nav::before { border-bottom: none; }
                .custom-tabs .ant-tabs-tab { background: #f8fafc; border-radius: 16px !important; border: 1px solid #e2e8f0 !important; margin-right: 8px !important; }
                .custom-tabs .ant-tabs-tab-active { background: #eff6ff !important; border-color: #bfdbfe !important; }
                .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1677ff !important; font-weight: 500; }
            `}</style>
        </div>
    );
}
