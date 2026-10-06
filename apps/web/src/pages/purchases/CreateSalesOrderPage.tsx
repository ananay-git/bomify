import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Form, Input, DatePicker, Select, Button, Table, Typography, Row, Col, Space, Divider, Tabs, Tag } from 'antd';
import { message } from '@/lib/antdHelper';
import { DeleteOutlined, QuestionCircleOutlined, DownloadOutlined, UploadOutlined, FormOutlined, LeftOutlined, EditOutlined, AppstoreAddOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getUser } from '@/app/store';
import { extractApiError } from '@/lib/errors';
import { fetchPartyById, Party } from '@/features/parties/api/parties';
import { purchasesApi } from '@/features/purchases/api';
import { inventoryApi, InventoryItem } from '@/features/inventory/api';
import AddItemModal from '@/features/inventory/components/AddItemModal';
import BuyerDetailsDrawer, { BuyerDetails } from '@/features/purchases/components/drawers/BuyerDetailsDrawer';
import DeliveryLocationDrawer from '@/features/purchases/components/drawers/DeliveryLocationDrawer';
import UserAddressDrawer from '@/features/purchases/components/drawers/UserAddressDrawer';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface POLineItem {
    key: number;
    itemId: number | null;
    description: string;
    hsn: string;
    quantity: number;
    units: string;
    currentStock: number;
    price: number;
    tax: number;
    discount1: number;
    discount2: number;
    inventoryItemData?: InventoryItem;
}

function useSessionStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) { return initialValue; }
    });
    useEffect(() => {
        try { window.sessionStorage.setItem(key, JSON.stringify(storedValue)); } catch (error) { console.error(error); }
    }, [key, storedValue]);
    return [storedValue, setStoredValue];
}

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) { return initialValue; }
    });
    useEffect(() => {
        try { window.localStorage.setItem(key, JSON.stringify(storedValue)); } catch (error) { console.error(error); }
    }, [key, storedValue]);
    return [storedValue, setStoredValue];
}

export default function CreateSalesOrderPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const buyerId = searchParams.get('buyerId');
    const buyerNameParam = searchParams.get('buyerName');
    
    const [form] = Form.useForm();
    const [items, setItems] = useState<POLineItem[]>([{ key: 1, itemId: null, description: '', hsn: '', quantity: 0, units: '', currentStock: 0, price: 0, tax: 0, discount1: 0, discount2: 0 }]);
    const [buyer, setBuyer] = useSessionStorage<Party | null>('oc_draft_buyer', null);
    const [loading, setLoading] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [addItemModalOpen, setAddItemModalOpen] = useState(false);
    const [rcmEnabled, setRcmEnabled] = useState(false);
    const [roundOffEnabled, setRoundOffEnabled] = useState(false);
    const [priceType, setPriceType] = useState<string>('default');

    const [isBuyerDrawerOpen, setIsBuyerDrawerOpen] = useState(false);
    const [isDeliveryLocationDrawerOpen, setIsDeliveryLocationDrawerOpen] = useState(false);
    const [isUserAddressDrawerOpen, setIsUserAddressDrawerOpen] = useState(false);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [selectedOptionalColumns, setSelectedOptionalColumns] = useState<string[]>([]);
    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);
    const [placeOfSupplySource, setPlaceOfSupplySource] = useSessionStorage<'company' | 'buyer' | 'delivery'>('oc_pos_source', 'delivery');
    
    const [buyerDetails, setBuyerDetails] = useLocalStorage<BuyerDetails>('oc_buyer_details', {});
    const [userAddress, setUserAddress] = useLocalStorage<any>('oc_user_address', { address1: 'Main Address,', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' });
    const [deliveryLocation, setDeliveryLocation] = useLocalStorage<any>('oc_delivery_location', { locationName: 'Main', address1: 'Main Address,', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India', billingLocations: [] });

    const currentUser = getUser();

    // Fetch inventory items
    const fetchInventoryItems = useCallback(async () => {
        try {
            const data = await inventoryApi.getAll();
            setInventoryItems(data.items);
        } catch { console.error('Failed to load inventory items'); }
    }, []);

    useEffect(() => { fetchInventoryItems(); }, [fetchInventoryItems]);

    useEffect(() => {
        if (currentUser && !buyerDetails.companyName) {
            setBuyerDetails({ companyName: currentUser.full_name || currentUser.username || "Checking", gstin: currentUser.id ? `27AADCB2230M1Z${currentUser.id}` : '', address: currentUser.email || "Main Address,", city: "Mumbai", state: "Maharashtra", pincode: "400001" });
        }
    }, [currentUser, buyerDetails.companyName]);

    // Handle copied PO items
    useEffect(() => {
        const storedItems = sessionStorage.getItem('oc_copy_items');
        const sourcePo = sessionStorage.getItem('oc_copy_source');
        if (storedItems) {
            try {
                const parsedItems = JSON.parse(storedItems);
                if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                    setItems(parsedItems.map((item, index) => ({
                        key: index + 1,
                        itemId: item.item_id,
                        description: item.description || '',
                        hsn: item.hsn || '',
                        quantity: item.ordered_quantity || 0,
                        units: item.units || '',
                        currentStock: item.currentStock || 0,
                        price: item.unit_price || 0,
                        tax: item.tax || 0,
                        discount1: 0,
                        discount2: 0,
                        inventoryItemData: undefined // Can't easily restore this fully without a second pass, but price is already mapped
                    })));
                    message.success(`Items copied from ${sourcePo || 'previous PO'}`);
                    // Optionally set a note reference
                    form.setFieldsValue({ notes: `Ref: Copied from ${sourcePo}` });
                }
                sessionStorage.removeItem('oc_copy_items');
                sessionStorage.removeItem('oc_copy_source');
            } catch (e) { console.error('Error parsing copied items', e); }
        }
    }, [form]);

    useEffect(() => {
        if (buyerId && buyerId !== '(No ID)') {
            fetchPartyById(buyerId).then(data => { setBuyer((prev) => ({ ...data, billingLocations: (prev as Party & { billingLocations?: unknown[] })?.billingLocations || [] }) as Party); }).catch(() => { message.error('Failed to load buyer details'); });
        }
    }, [buyerId, form]);

    useEffect(() => {
        if (deliveryLocation) { form.setFieldsValue({ city: deliveryLocation.city || '', state: deliveryLocation.state || '', country: deliveryLocation.country || 'India' }); }
    }, [deliveryLocation, form]);

    const getItemPrice = useCallback((item: InventoryItem) => {
        if (priceType === 'regular') return Number(item.regular_buying_price) || Number(item.default_price) || 0;
        if (priceType === 'wholesale') return Number(item.wholesale_buying_price) || Number(item.default_price) || 0;
        return Number(item.default_price) || 0;
    }, [priceType]);

    // When price type changes, update ALL existing items that have inventory data
    useEffect(() => {
        setItems(prev => prev.map(item => {
            if (!item.inventoryItemData) return item;
            return { ...item, price: getItemPrice(item.inventoryItemData) };
        }));
    }, [priceType, getItemPrice]);

    // Calculate the net amount for a single line item (after discounts, before tax)
    const getLineNetAmount = useCallback((item: POLineItem) => {
        const gross = item.quantity * item.price;
        const afterDisc1 = gross * (1 - (item.discount1 || 0) / 100);
        const afterDisc2 = afterDisc1 * (1 - (item.discount2 || 0) / 100);
        return afterDisc2;
    }, []);

    // Calculations
    const calculations = useMemo(() => {
        const validItems = items.filter(i => i.itemId && i.quantity > 0);
        const totalBeforeTax = validItems.reduce((sum, i) => sum + getLineNetAmount(i), 0);
        const totalTax = rcmEnabled ? 0 : validItems.reduce((sum, i) => sum + (getLineNetAmount(i) * (i.tax / 100)), 0);
        const totalAfterTax = totalBeforeTax + totalTax;
        const roundOff = roundOffEnabled ? Math.round(totalAfterTax) - totalAfterTax : 0;
        const grandTotal = totalAfterTax + roundOff;
        const totalDiscount = validItems.reduce((sum, i) => sum + (i.quantity * i.price) - getLineNetAmount(i), 0);
        return { totalBeforeTax, totalTax, totalAfterTax, roundOff, grandTotal, totalDiscount };
    }, [items, rcmEnabled, roundOffEnabled, getLineNetAmount]);

    const handleItemSelect = (key: number, inventoryItemId: number | null) => {
        if (inventoryItemId === -1) { setAddItemModalOpen(true); return; }
        setItems(prev => prev.map(item => {
            if (item.key !== key) return item;
            if (!inventoryItemId) return { ...item, itemId: null, description: '', hsn: '', units: '', currentStock: 0, price: 0, tax: 0, discount1: 0, discount2: 0, inventoryItemData: undefined };
            const invItem = inventoryItems.find(i => i.id === inventoryItemId);
            if (!invItem) return item;
            return { ...item, itemId: invItem.id, description: invItem.name, hsn: invItem.hsn_code || '', units: invItem.unit_of_measure, currentStock: Number(invItem.current_stock), price: getItemPrice(invItem), tax: Number(invItem.tax) || 0, discount1: 0, discount2: 0, inventoryItemData: invItem };
        }));
    };

    const handleFieldChange = (key: number, field: string, value: any) => {
        setItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
    };

    const handlePlaceOfSupplyClick = (source: 'company' | 'buyer' | 'delivery') => {
        setPlaceOfSupplySource(source);
        let city = '', state = '', country = 'India';
        if (source === 'company') { city = userAddress.city || ''; state = userAddress.state || ''; country = userAddress.country || 'India'; }
        else if (source === 'buyer') { city = buyer?.city || ''; state = buyer?.state || ''; country = buyer?.country || 'India'; }
        else { city = deliveryLocation.city || ''; state = deliveryLocation.state || ''; country = deliveryLocation.country || 'India'; }
        form.setFieldsValue({ city, state, country });
    };

    const handleSave = async (status: 'draft' | 'sent') => {
        try {
            setLoading(true);
            const values = status === 'draft' ? form.getFieldsValue(true) : await form.validateFields();
            const validItems = items.filter(i => i.itemId && i.quantity > 0);
            if (status === 'sent' && validItems.length === 0) { message.error('Please add at least one item with quantity'); setLoading(false); return; }
            const ocNumber = values.so_number || `OC-${Date.now()}`;
            const result = await purchasesApi.create({
                po_number: ocNumber,
                supplier_id: Number(buyerId),
                document_type: 'order_confirmation',
                status: status === 'sent' ? 'sent' : 'draft',
                expected_delivery_date: values.expected_delivery ? values.expected_delivery.toISOString() : null,
                notes: values.notes || null,
                items: validItems.map(i => ({ item_id: i.itemId!, ordered_quantity: i.quantity, unit_price: i.price }))
            });
            // Clear storage
            ['oc_draft_buyer', 'oc_pos_source'].forEach(k => sessionStorage.removeItem(k));
            ['oc_buyer_details', 'oc_user_address', 'oc_delivery_location'].forEach(k => localStorage.removeItem(k));
            message.success(status === 'draft' ? 'Order Confirmation saved as draft' : 'Order Confirmation created successfully!');
            if (status === 'sent') {
                navigate(`/app/purchases/order-confirmation/${result.id}?buyerName=${encodeURIComponent(buyer?.name || buyerNameParam || '')}`);
            } else {
                navigate('/app/purchases');
            }
        } catch (error) {
            console.error('Error:', error);
            message.error(extractApiError(error, 'Please check required fields and try again.'));
        } finally { setLoading(false); }
    };

    const handleAddItem = () => { setItems([...items, { key: Date.now(), itemId: null, description: '', hsn: '', quantity: 0, units: '', currentStock: 0, price: 0, tax: 0, discount1: 0, discount2: 0 }]); };
    const handleRemoveItem = (key: number) => { setItems(items.filter(item => item.key !== key)); };

    const handleDownloadTemplate = () => {
        const headers = ['Item ID', 'Description', 'HSN/SAC Code', 'Quantity', 'Units', 'Price', 'Tax %'];
        const dataRows = items.map(item => [item.inventoryItemData?.sku || '', item.description, item.hsn, item.quantity, item.units, item.price, item.tax]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Items');
        XLSX.writeFile(wb, 'purchase_item_table.xlsx');
    };

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const itemDropdownOptions = [
        { value: -1, label: <span style={{ color: '#1677ff', fontWeight: 600 }}><PlusOutlined /> Add New Item</span> },
        ...inventoryItems.map(inv => ({ value: inv.id, label: `${inv.sku} - ${inv.name}` }))
    ];

    const taxOptions = [
        { value: 0, label: 'None (0%)' }, { value: 5, label: 'GST 5%' }, { value: 12, label: 'GST 12%' }, { value: 18, label: 'GST 18%' }, { value: 28, label: 'GST 28%' }
    ];

    const unitOptions = ['Kg', 'g', 'Liter', 'ml', 'Meter', 'cm', 'Piece', 'Box', 'Dozen', 'Ton', 'Bag', 'Roll'].map(u => ({ value: u, label: u }));

    const optionalColumnDefs: Record<string, any> = {
        alternateUnit: { title: 'Alt. Unit', dataIndex: 'alternateUnit', key: 'alternateUnit', width: 110, render: (_: any, record: POLineItem) => <Select style={{ width: 100 }} placeholder="Unit" options={unitOptions} onChange={val => handleFieldChange(record.key, 'alternateUnit', val)} /> },
        discount1: { title: 'Discount 1 (%)', dataIndex: 'discount1', key: 'discount1', width: 130, render: (_: any, record: POLineItem) => (
            <Select style={{ width: 110 }} value={record.discount1} onChange={val => handleFieldChange(record.key, 'discount1', val)}
                options={[{value:0,label:'None (0%)'},{value:2,label:'2%'},{value:5,label:'5%'},{value:8,label:'8%'},{value:10,label:'10%'},{value:12,label:'12%'},{value:15,label:'15%'},{value:20,label:'20%'},{value:25,label:'25%'}]} />
        )},
        discount2: { title: 'Discount 2 (%)', dataIndex: 'discount2', key: 'discount2', width: 130, render: (_: any, record: POLineItem) => (
            <Select style={{ width: 110 }} value={record.discount2} onChange={val => handleFieldChange(record.key, 'discount2', val)}
                options={[{value:0,label:'None (0%)'},{value:1,label:'1%'},{value:2,label:'2%'},{value:3,label:'3%'},{value:5,label:'5%'},{value:8,label:'8%'},{value:10,label:'10%'}]} />
        )},
        amount: { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, render: (_: any, record: POLineItem) => {
            const net = getLineNetAmount(record);
            return <Text strong className="text-slate-700">{formatCurrency(net)}</Text>;
        }},
        totalTax: { title: 'Total Tax', dataIndex: 'totalTax', key: 'totalTax', width: 120, render: (_: any, record: POLineItem) => {
            const net = getLineNetAmount(record);
            const tax = net * (record.tax / 100);
            return <Text className="text-slate-500">{formatCurrency(tax)}</Text>;
        }},
        deliveryDate: { title: 'Delivery Date', dataIndex: 'deliveryDate', key: 'deliveryDate', width: 150, render: () => <DatePicker size="small" style={{ width: 130 }} format="DD/MM/YYYY" disabledDate={(current) => current && current < dayjs().startOf('day')} /> },
        comments: { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 160, render: () => <Input placeholder="Notes..." style={{ width: 140 }} /> },
    };

    const optionalColumnsOptions = [
        { label: 'Discount 1', value: 'discount1' }, { label: 'Discount 2', value: 'discount2' },
        { label: 'Amount', value: 'amount' }, { label: 'Total Tax', value: 'totalTax' },
        { label: 'Alternate Unit', value: 'alternateUnit' }, { label: 'Delivery Date', value: 'deliveryDate' }, { label: 'Comments', value: 'comments' },
    ];

    const baseColumns = [
        { title: 'Item ID', dataIndex: 'itemId', key: 'itemId', width: 200, render: (_: any, record: POLineItem) => (
            <Select style={{ width: 180 }} placeholder="Select" value={record.itemId} onChange={(val) => handleItemSelect(record.key, val)} options={itemDropdownOptions} showSearch optionFilterProp="label" allowClear onClear={() => handleItemSelect(record.key, null)} />
        )},
        { title: 'Item Description', dataIndex: 'description', key: 'description', render: (_: any, record: POLineItem) => <Input value={record.description} onChange={e => handleFieldChange(record.key, 'description', e.target.value)} placeholder="Description" /> },
        { title: 'HSN/SAC Code', dataIndex: 'hsn', key: 'hsn', width: 120, render: (_: any, record: POLineItem) => <Input style={{ width: 100 }} value={record.hsn} onChange={e => handleFieldChange(record.key, 'hsn', e.target.value)} /> },
        { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 90, render: (_: any, record: POLineItem) => <Input type="number" value={record.quantity} onChange={e => handleFieldChange(record.key, 'quantity', Number(e.target.value))} style={{ width: 80 }} /> },
        { title: 'Units', dataIndex: 'units', key: 'units', width: 110, render: (_: any, record: POLineItem) => <Select style={{ width: 100 }} value={record.units || undefined} onChange={val => handleFieldChange(record.key, 'units', val)} placeholder="Unit" options={unitOptions} /> },
        { title: 'Current Stock', dataIndex: 'currentStock', key: 'currentStock', width: 110, render: (_: any, record: POLineItem) => <Text>{record.currentStock || '-'}</Text> },
        { title: priceType === 'regular' ? 'Price (Regular)' : priceType === 'wholesale' ? 'Price (Wholesale)' : 'Price (Default)', dataIndex: 'price', key: 'price', width: 130, render: (_: any, record: POLineItem) => <Input type="number" value={record.price} onChange={e => handleFieldChange(record.key, 'price', Number(e.target.value))} style={{ width: 100 }} /> },
        { title: 'Tax', dataIndex: 'tax', key: 'tax', width: 110, render: (_: any, record: POLineItem) => <Select style={{ width: 100 }} value={record.tax} onChange={val => handleFieldChange(record.key, 'tax', val)} options={taxOptions} /> },
    ];

    const itemColumns = [
        ...baseColumns,
        ...selectedOptionalColumns.map(key => optionalColumnDefs[key]).filter(Boolean),
        { title: '', key: 'action', width: 50, render: (_: any, record: POLineItem) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} /> },
    ];


    return (
        <div style={{ maxWidth: '1536px', width: '100%', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div className="bg-[#001529] text-white p-3 px-6 rounded-t-lg flex justify-between items-center mt-2 shadow-sm">
                <Space size="middle">
                    <Button type="text" icon={<LeftOutlined />} onClick={() => navigate('/app/purchases')} className="text-white hover:text-gray-200" />
                    <FormOutlined style={{ fontSize: '18px' }} />
                    <Title level={4} style={{ margin: 0, color: 'white' }}>Order Confirmation</Title>
                </Space>
                <div className="flex items-center gap-4">
                    <Text style={{ color: '#ffffff', fontSize: 12 }}>Buyer ID: {buyerId}</Text>
                    <Select defaultValue="INR" style={{ width: 90 }} popupMatchSelectWidth={false}><Option value="INR">INR - ₹</Option><Option value="USD">USD - $</Option></Select>
                    <Button type="text" className="text-white hover:text-gray-200"><QuestionCircleOutlined /></Button>
                    <Button
                        onClick={() => navigate('/app/purchases')}
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
                {/* Top Section */}
                <Row gutter={24}>
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Buyer Details</div>} extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600" />} onClick={() => setIsBuyerDrawerOpen(true)} />} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <div className="mb-4"><Text strong className="text-[15px] text-slate-800">{buyerDetails.companyName}</Text><div className="text-slate-500 text-[12px] mt-1">GSTIN: <span className="text-slate-700 font-medium">{buyerDetails.gstin}</span></div></div>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group">
                                    <div className="flex justify-between items-start mb-1"><Text className="text-slate-600 text-[13px] font-medium">Billing Address</Text><Button type="text" size="small" className="h-auto p-0 opacity-0 group-hover:opacity-100 transition-opacity" icon={<EditOutlined className="text-slate-400 hover:text-blue-600" />} onClick={() => setIsUserAddressDrawerOpen(true)} /></div>
                                    <Text className="text-slate-500 text-[12px] leading-relaxed block">{userAddress.address1}<br/>{userAddress.city} ({userAddress.state})<br/>{userAddress.country} - {userAddress.pincode}</Text>
                                    <div className="flex justify-end mt-2"><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'company' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => handlePlaceOfSupplyClick('company')}>{placeOfSupplySource === 'company' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                                </div>
                            </Card>
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white flex-1" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Buyer Details</div>} extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600"/>} onClick={() => setIsBuyerDrawerOpen(true)} />} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <div className="flex justify-between items-start mb-2"><Text strong className="text-[15px] text-slate-800">{buyer?.name || buyerNameParam || "Selected Buyer"}</Text><Text className="text-slate-700 font-medium text-[12px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">GSTIN: {buyer?.gstin || "26AALFP7255P1ZE"}</Text></div>
                                <Text className="text-slate-500 text-[12px] leading-relaxed block">{buyer?.address1 || "SURVEY NO.218/1/4, Unnamed Road"}<br/>{buyer?.city ? `${buyer.city}, ${buyer.state || ''}` : "Dadra & Nagar Haveli"}<br/>{buyer?.country || 'India'} - {buyer?.pincode || '396193'}</Text>
                                <div className="flex justify-end mt-4 pt-3 border-t border-slate-100"><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'buyer' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => handlePlaceOfSupplyClick('buyer')}>{placeOfSupplySource === 'buyer' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                            </Card>
                        </div>
                    </Col>
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Delivery Location</div>} extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600"/>} onClick={() => setIsDeliveryLocationDrawerOpen(true)} />} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <Text strong className="text-[14px] text-slate-800">{deliveryLocation.locationName || 'Main'}</Text>
                                <Text className="text-slate-500 text-[12px] leading-relaxed block mt-2">{deliveryLocation.address1 || "Main Address,"}<br/>{deliveryLocation.city || "Mumbai"} ({deliveryLocation.state || "Maharashtra"})<br/>{deliveryLocation.country || "India"} - {deliveryLocation.pincode || "400001"}</Text>
                                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100"><Text className="text-slate-500 text-[12px] font-medium">GSTIN : <span className="text-slate-400">{deliveryLocation.gstin || "Not provided"}</span></Text><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'delivery' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => handlePlaceOfSupplyClick('delivery')}>{placeOfSupplySource === 'delivery' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                            </Card>
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white flex-1" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide flex items-center gap-2">Place Of Supply <Tag color={placeOfSupplySource === 'company' ? 'blue' : placeOfSupplySource === 'buyer' ? 'purple' : 'green'} className="text-[10px] m-0 border-0">{placeOfSupplySource === 'company' ? 'From Company' : placeOfSupplySource === 'buyer' ? 'From Buyer' : 'From Delivery'}</Tag></div>} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <Form.Item name="city" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">City <span className="text-red-500">*</span></span>} style={{ marginBottom: 16 }}><Input className="rounded-lg border-gray-300" /></Form.Item>
                                <Row gutter={16}><Col span={12}><Form.Item name="state" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">State <span className="text-red-500">*</span></span>} style={{ marginBottom: 0 }}><Select options={[{value: 'Maharashtra', label: 'Maharashtra'}, {value: 'Gujarat', label: 'Gujarat'}, {value: 'Delhi', label: 'Delhi'}, {value: 'Karnataka', label: 'Karnataka'}, {value: 'Tamil Nadu', label: 'Tamil Nadu'}]} /></Form.Item></Col><Col span={12}><Form.Item name="country" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Country <span className="text-red-500">*</span></span>} style={{ marginBottom: 0 }}><Select options={[{value: 'India', label: 'India'}]} /></Form.Item></Col></Row>
                            </Card>
                        </div>
                    </Col>
                    <Col span={8}>
                        <Card size="small" className="border border-blue-100 shadow-[0_4px_12px_rgba(37,99,235,0.06)] rounded-xl bg-gradient-to-b from-white to-[#f8fafc] h-full overflow-hidden" title={<div className="text-blue-700 font-semibold text-[13px] uppercase tracking-wide">Primary Document Details</div>} extra={<Button type="text" size="small" className="text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm rounded-md px-2" onClick={() => setShowOptionalFields(!showOptionalFields)}>{showOptionalFields ? 'Hide Optional Fields' : 'Show Optional Fields'}</Button>} styles={{ header: { backgroundColor: '#f0f4f8', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px 20px' } }}>
                            <Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Title <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}><Input defaultValue={`Order Confirmation dated ${dayjs().format('DD/MM/YYYY')}`} className="rounded-lg border-gray-300 py-1.5 font-medium text-slate-800" /></Form.Item>
                            <Row gutter={20}><Col span={12}><Form.Item name="so_number" label={<span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Document Number <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}><Input className="rounded-lg border-blue-200 px-3 py-1.5 font-medium" /></Form.Item></Col><Col span={12}><Form.Item name="document_date" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Document Date</span>} style={{ marginBottom: 20 }} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" disabled format="DD/MM/YYYY" /></Form.Item></Col></Row>
                            <Row gutter={20}><Col span={12}><Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amendment</span>} style={{ marginBottom: 20 }}><Input defaultValue="0" className="rounded-lg border-gray-300 py-1.5" /></Form.Item></Col><Col span={12}><Form.Item name="expected_delivery" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Delivery Date <span className="text-red-500">*</span></span>} style={{ marginBottom: 20 }}><DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-300 py-1.5" disabledDate={(current) => current && current < dayjs().startOf('day')} format="DD/MM/YYYY" /></Form.Item></Col></Row>
                            <Row gutter={20}><Col span={12}><Form.Item label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Store <span className="text-red-500">*</span></span>} style={{ marginBottom: showOptionalFields ? 20 : 0 }}><Select defaultValue="Default Stock Store" className="w-full text-slate-700 font-medium" /></Form.Item></Col></Row>
                            {showOptionalFields && (<>
                                <Divider className="my-3" style={{ borderColor: '#e2e8f0' }} />
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Optional Fields</div>
                                <Row gutter={20}>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OC Number</span>} style={{ marginBottom: 20 }}><Input className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500 py-1.5" /></Form.Item></Col>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OC Date</span>} style={{ marginBottom: 20 }}><DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500 py-1.5" format="DD/MM/YYYY" disabledDate={(current) => current && current < dayjs().startOf('day')} /></Form.Item></Col>
                                </Row>
                                <Row gutter={20}>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Indent Number</span>} style={{ marginBottom: 20 }}><Input className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500 py-1.5" /></Form.Item></Col>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Indent Date</span>} style={{ marginBottom: 20 }}><DatePicker style={{ width: '100%' }} className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500 py-1.5" format="DD/MM/YYYY" disabledDate={(current) => current && current < dayjs().startOf('day')} /></Form.Item></Col>
                                </Row>
                                <Row gutter={20}>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Payment Term</span>} style={{ marginBottom: 20 }}><Select placeholder="Select" className="w-full text-slate-700" options={[{ value: 'net30', label: 'Net 30' }, { value: 'net60', label: 'Net 60' }, { value: 'net90', label: 'Net 90' }, { value: 'immediate', label: 'Immediate' }, { value: 'cod', label: 'Cash on Delivery' }]} /></Form.Item></Col>
                                    <Col span={12}><Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Kind Attention</span>} style={{ marginBottom: 20 }}><Input placeholder="e.g. Mr. Sharma" className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500 py-1.5" /></Form.Item></Col>
                                </Row>
                                <Form.Item label={<span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OC Details</span>} style={{ marginBottom: 0 }}><Input.TextArea rows={2} placeholder="Enter OC details..." className="rounded-lg border-gray-200 bg-slate-50 hover:bg-white hover:border-blue-400 focus:border-blue-500" /></Form.Item>
                            </>)}
                        </Card>
                    </Col>
                </Row>

                <Divider className="my-6" />

                {/* Items Table Section */}
                <div className="px-4">
                    <div className="mb-4 flex justify-between items-center">
                        <Space><Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Download Item Template</Button><Button icon={<UploadOutlined />}>Bulk Upload</Button></Space>
                        <Space align="center" size="middle">
                            <div className="flex items-center gap-2"><Text className="text-xs font-medium text-slate-500">Price type</Text><Select value={priceType} onChange={setPriceType} size="small" style={{ width: 180 }} options={[{value:'default',label:'Default Price'},{value:'regular',label:'Regular Buying Price'},{value:'wholesale',label:'Wholesale Buying Price'}]} /></div>
                            <Select mode="multiple" size="small" style={{ minWidth: 180 }} placeholder={<span><AppstoreAddOutlined /> Optional Columns</span>} value={selectedOptionalColumns} onChange={setSelectedOptionalColumns} options={optionalColumnsOptions} maxTagCount={1} maxTagPlaceholder={(omitted) => `+${omitted.length}`} />
                            <Input.Search placeholder="Search with Id or..." size="small" style={{ width: 160 }} />
                        </Space>
                    </div>

                    <Table columns={itemColumns} dataSource={items} pagination={false} size="small" className="mb-4 border border-gray-200" scroll={selectedOptionalColumns.length > 2 ? { x: 'max-content' } : undefined} rowClassName={() => 'bg-white hover:bg-gray-50'} components={{ header: { cell: (props: any) => <th {...props} style={{ background: '#f0fdfa', color: '#0f766e', fontWeight: 600, fontSize: '13px' }} /> } }} />
                    <Button type="primary" onClick={handleAddItem} className="mb-8" style={{ marginLeft: 0 }}>+ ADD ITEM</Button>

                    {/* Bottom Section: Tabs & Summary */}
                    <Row gutter={32}>
                        <Col span={14}><DocumentTabsSection mode="create" value={documentTabsData} onChange={setDocumentTabsData} /></Col>
                        <Col span={10}>
                            <div className="p-4 rounded-md">
                                <div className="flex justify-between mb-4"><Text className="text-gray-500">Additional Discount</Text><Select defaultValue="select" size="small" style={{ width: 100 }} options={[{value:'select',label:'select'},{value:'percentage',label:'%'},{value:'flat',label:'₹ Flat'}]} /></div>
                                {calculations.totalDiscount > 0 && (
                                    <div className="flex justify-between mb-2"><Text className="text-orange-500">Item Discounts :</Text><Text strong className="text-orange-500">- {formatCurrency(calculations.totalDiscount)}</Text></div>
                                )}
                                <div className="flex justify-between mb-2"><Text className="text-gray-500">Total (before tax) :</Text><Text strong>{formatCurrency(calculations.totalBeforeTax)}</Text></div>
                                <div className="flex justify-between mb-3 items-center">
                                    <Space size="middle">
                                        <Button
                                            size="small"
                                            onClick={() => setRcmEnabled(!rcmEnabled)}
                                            style={{
                                                borderRadius: 4,
                                                fontWeight: 700,
                                                fontSize: 13,
                                                padding: '2px 12px',
                                                border: rcmEnabled ? '2px solid #1677ff' : '2px solid #91caff',
                                                background: rcmEnabled ? '#e6f4ff' : '#fff',
                                                color: rcmEnabled ? '#1677ff' : '#4096ff',
                                                boxShadow: rcmEnabled ? '0 0 0 2px rgba(22,119,255,0.15)' : 'none',
                                            }}
                                        >
                                            RCM{rcmEnabled ? ' ✓' : ''}
                                        </Button>
                                        <Text className="text-gray-500">Total Tax :</Text>
                                    </Space>
                                    <Text strong>{formatCurrency(calculations.totalTax)}</Text>
                                </div>
                                <div className="flex justify-between mb-4"><Text className="text-gray-500">Total (after tax) :</Text><Text strong>{formatCurrency(calculations.totalAfterTax)}</Text></div>
                                <div className="flex justify-between mb-4 items-center">
                                    <Space size="middle">
                                        <Button
                                            size="small"
                                            onClick={() => setRoundOffEnabled(!roundOffEnabled)}
                                            style={{
                                                borderRadius: 4,
                                                fontWeight: 700,
                                                fontSize: 13,
                                                padding: '2px 12px',
                                                border: roundOffEnabled ? '2px solid #52c41a' : '2px solid #b7b7b7',
                                                background: roundOffEnabled ? '#f6ffed' : '#fff',
                                                color: roundOffEnabled ? '#52c41a' : '#595959',
                                                boxShadow: roundOffEnabled ? '0 0 0 2px rgba(82,196,26,0.15)' : 'none',
                                            }}
                                        >
                                            Round-off{roundOffEnabled ? ' ✓' : ''}
                                        </Button>
                                        <Text strong className="text-base">Grand Total :</Text>
                                    </Space>
                                    <Text strong className="text-lg">{formatCurrency(calculations.grandTotal)}</Text>
                                </div>
                                <div className="flex justify-between items-center border-t pt-4"><Text className="text-gray-500">Advance To Pay :</Text><div className="flex items-center border-b"><span className="mr-1">₹</span><Input variant="borderless" className="w-20 px-1 text-right" placeholder="0.00" /></div></div>
                            </div>
                        </Col>
                    </Row>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                        <Button size="large" onClick={() => handleSave('draft')} loading={loading} className="px-8">SAVE DRAFT</Button>
                        <Button size="large" type="primary" onClick={() => handleSave('sent')} loading={loading} className="px-8">SAVE AND SEND</Button>
                    </div>
                </div>
            </Form>

            {/* Drawers & Modals */}
            <BuyerDetailsDrawer open={isBuyerDrawerOpen} onClose={() => setIsBuyerDrawerOpen(false)} buyer={buyerDetails} onSave={setBuyerDetails} />
            <BuyerDetailsDrawer open={isBuyerDrawerOpen} onClose={() => setIsBuyerDrawerOpen(false)} buyer={(buyer as unknown as BuyerDetails) || {}} onSave={(data) => setBuyer(data as Party)} />
            <DeliveryLocationDrawer open={isDeliveryLocationDrawerOpen} onClose={() => setIsDeliveryLocationDrawerOpen(false)} deliveryLocation={deliveryLocation} onSave={setDeliveryLocation} />
            <UserAddressDrawer open={isUserAddressDrawerOpen} onClose={() => setIsUserAddressDrawerOpen(false)} addressData={userAddress} onSave={setUserAddress} />
            <AddItemModal open={addItemModalOpen} onClose={() => setAddItemModalOpen(false)} onSuccess={() => { fetchInventoryItems(); setAddItemModalOpen(false); }} />

            <style>{`
                .custom-tabs .ant-tabs-nav::before { border-bottom: none; }
                .custom-tabs .ant-tabs-tab { background: #f8fafc; border-radius: 16px !important; border: 1px solid #e2e8f0 !important; margin-right: 8px !important; }
                .custom-tabs .ant-tabs-tab-active { background: #eff6ff !important; border-color: #bfdbfe !important; }
                .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1677ff !important; font-weight: 500; }
            `}</style>
        </div>
    );
}
