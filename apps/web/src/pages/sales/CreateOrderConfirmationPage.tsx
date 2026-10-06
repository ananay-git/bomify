import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Form, Input, Button, DatePicker, Select, Typography, Table, Space, Divider, Row, Col, Tabs, InputNumber, message, Tag, Card } from "antd";
import { PlusOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, LeftOutlined, CloseOutlined, SettingOutlined, EditOutlined } from "@ant-design/icons";
import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';
import { useNavigate, useLocation } from "react-router-dom";
import { orderConfirmationApi, OrderConfirmationItemCreate } from "@/features/sales/api";
import { inventoryApi } from "@/features/inventory/api";
import { fetchParties } from "@/features/parties/api/parties";
import BuyerDetailsDrawer, { BuyerDetails } from '@/features/purchases/components/drawers/BuyerDetailsDrawer';
import DeliveryLocationDrawer from '@/features/purchases/components/drawers/DeliveryLocationDrawer';
import UserAddressDrawer from '@/features/purchases/components/drawers/UserAddressDrawer';
import { getUser } from '@/app/store';

const { Title, Text } = Typography;
const { Option } = Select;

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch (error) { return initialValue; }
    });
    useEffect(() => {
        try { window.localStorage.setItem(key, JSON.stringify(storedValue)); } catch (error) { console.error(error); }
    }, [key, storedValue]);
    return [storedValue, setStoredValue];
}

export default function CreateOrderConfirmationPage() {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    
    // URL params (buyer selection from previous screen)
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const preBuyerId = queryParams.get("buyerId");
    
    const [buyers, setBuyers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    
    // Table state
    const [dataSource, setDataSource] = useState<any[]>([{
        key: Date.now().toString(),
        item_id: null,
        description: "",
        hsnCode: "",
        quantity: 1,
        units: "Unit",
        currentStock: "-",
        rate: 0,
        tax: 0,
        discount1: 0,
        discount2: 0,
        total: 0
    }]);

    const [isBuyerDrawerOpen, setIsBuyerDrawerOpen] = useState(false);
    const [isDeliveryLocationDrawerOpen, setIsDeliveryLocationDrawerOpen] = useState(false);
    const [isUserAddressDrawerOpen, setIsUserAddressDrawerOpen] = useState(false);
    const [buyerDetails, setBuyerDetails] = useLocalStorage<BuyerDetails>('oc_buyer_details', {});
    const [userAddress, setUserAddress] = useLocalStorage<any>('oc_user_address', { address1: 'Main Address,', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' });
    const [deliveryLocation, setDeliveryLocation] = useLocalStorage<any>('oc_delivery_location', { locationName: 'Main', address1: 'Main Address,', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' });
    const [placeOfSupplySource, setPlaceOfSupplySource] = useState<'company' | 'buyer' | 'delivery'>('delivery');
    
    const [rcmEnabled, setRcmEnabled] = useState(false);
    const [roundOffEnabled, setRoundOffEnabled] = useState(false);
    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);

    const currentUser = getUser();
    useEffect(() => {
        if (currentUser && !buyerDetails.companyName) {
            setBuyerDetails({ companyName: currentUser.full_name || currentUser.username || "System Administrator", gstin: currentUser.id ? `27AADCB2230M1Z${currentUser.id}` : '27AADCB2230M1Z1', address: currentUser.email || "Main Address,", city: "Mumbai", state: "Maharashtra", pincode: "400001" });
        }
    }, [currentUser, buyerDetails.companyName]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const partiesData = await fetchParties("buyer");
                setBuyers(partiesData.parties || []);
                
                const itemsData = await inventoryApi.getAll();
                setItems(itemsData.items || []);

                if (preBuyerId) {
                    form.setFieldsValue({ buyer_id: Number(preBuyerId) });
                }
            } catch (err) {
                message.error("Failed to load initial data.");
            }
        };
        loadInitialData();
        
        // Default form values
        form.setFieldsValue({
            amendment: 0,
            store: "Default Stock Store"
        });
    }, []);

    const handleAddItem = () => {
        const newItem = {
            key: Date.now().toString(),
            item_id: null,
            description: "",
            hsnCode: "",
            quantity: 1,
            units: "Unit",
            currentStock: "-",
            rate: 0,
            tax: "None",
            total: 0
        };
        setDataSource([...dataSource, newItem]);
    };

    const handleRemoveItem = (key: string) => {
        setDataSource(dataSource.filter(item => item.key !== key));
    };

    const handleItemChange = (key: string, field: string, value: any) => {
        const newData = dataSource.map(row => {
            if (row.key === key) {
                const updatedRow = { ...row, [field]: value };
                if (field === 'item_id') {
                    const selectedItem = items.find(i => i.id === value);
                    if (selectedItem) {
                        updatedRow.rate = Number(selectedItem.default_price) || 0;
                        updatedRow.hsnCode = selectedItem.hsn_code || "";
                        updatedRow.description = selectedItem.description || selectedItem.name;
                        updatedRow.units = selectedItem.unit_of_measure || "Unit";
                        updatedRow.currentStock = selectedItem.current_stock !== undefined ? selectedItem.current_stock : "-";
                        updatedRow.tax = Number(selectedItem.tax) || 0;
                    }
                }
                
                return updatedRow;
            }
            return row;
        });
        setDataSource(newData);
    };

    const calculations = useMemo(() => {
        const validItems = dataSource.filter(i => i.item_id && i.quantity > 0);
        
        const getLineNetAmount = (item: any) => {
            const gross = item.quantity * item.rate;
            const afterDisc1 = gross * (1 - (item.discount1 || 0) / 100);
            return afterDisc1 * (1 - (item.discount2 || 0) / 100);
        };

        const totalBeforeTax = validItems.reduce((sum, i) => sum + getLineNetAmount(i), 0);
        const totalTax = rcmEnabled ? 0 : validItems.reduce((sum, i) => sum + (getLineNetAmount(i) * (i.tax / 100)), 0);
        const totalAfterTax = totalBeforeTax + totalTax;
        const roundOff = roundOffEnabled ? Math.round(totalAfterTax) - totalAfterTax : 0;
        const grandTotal = totalAfterTax + roundOff;
        const totalDiscount = validItems.reduce((sum, i) => sum + (i.quantity * i.rate) - getLineNetAmount(i), 0);
        return { totalBeforeTax, totalTax, totalAfterTax, roundOff, grandTotal, totalDiscount };
    }, [dataSource, rcmEnabled, roundOffEnabled]);

    const handleSave = async (status: "draft" | "created" | "completed") => {
        try {
            const values = await form.validateFields();
            
            if (dataSource.length === 0 || dataSource.every(d => !d.item_id)) {
                message.error("Please add at least one valid item.");
                return;
            }

            setLoading(true);

            const payloadItems: OrderConfirmationItemCreate[] = dataSource
                .filter(row => row.item_id)
                .map(row => ({
                    item_id: row.item_id,
                    quantity: row.quantity,
                    rate: row.rate,
                    taxable_amount: row.taxable_amount,
                    total: row.total
                }));

            const payload = {
                doc_number: values.doc_number,
                buyer_id: values.buyer_id,
                doc_date: values.doc_date ? values.doc_date.toISOString() : null,
                delivery_date: values.delivery_date ? values.delivery_date.toISOString() : null,
                status: status,
                notes: values.notes || "",
                items: payloadItems
            };

            const response = await orderConfirmationApi.create(payload);
            message.success("Order Confirmation saved successfully!");
            navigate(`/app/sales/order-confirmation/${response.id}`);
        } catch (error: any) {
            console.error(error);
            if (error.errorFields) return; // Validation failed
            message.error(error?.response?.data?.detail || "Failed to save Order Confirmation");
        } finally {
            setLoading(false);
        }
    };

    // Selected Buyer Details
    const buyerId = Form.useWatch('buyer_id', form);
    const selectedBuyer = buyers.find(b => b.id === buyerId);

    const columns = [
        {
            title: "Item ID",
            dataIndex: "item_id",
            width: "15%",
            render: (_text: any, record: any) => (
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Select"
                    value={record.item_id}
                    onChange={(val) => handleItemChange(record.key, "item_id", val)}
                    optionFilterProp="children"
                >
                    {items.map(item => (
                        <Option key={item.id} value={item.id}>{item.sku}</Option>
                    ))}
                </Select>
            )
        },
        {
            title: "Item Description",
            dataIndex: "description",
            width: "25%",
            render: (text: string, record: any) => (
                <Input 
                    value={text} 
                    onChange={(e) => handleItemChange(record.key, "description", e.target.value)}
                    placeholder="Description"
                />
            )
        },
        {
            title: "HSN/SAC Code",
            dataIndex: "hsnCode",
            width: "10%",
            render: (text: string, record: any) => (
                <Input 
                    value={text} 
                    onChange={(e) => handleItemChange(record.key, "hsnCode", e.target.value)} 
                />
            )
        },
        {
            title: "Quantity",
            dataIndex: "quantity",
            width: "8%",
            render: (_text: any, record: any) => (
                <InputNumber
                    min={1}
                    style={{ width: '100%' }}
                    value={record.quantity}
                    onChange={(val) => handleItemChange(record.key, "quantity", val)}
                />
            )
        },
        {
            title: "Units",
            dataIndex: "units",
            width: "8%",
            render: (text: string) => (
                <Select defaultValue="Unit" style={{ width: '100%' }}>
                    <Option value="Unit">Unit</Option>
                    <Option value="Kg">Kg</Option>
                    <Option value="Pcs">Pcs</Option>
                </Select>
            )
        },
        {
            title: "Current Stock",
            dataIndex: "currentStock",
            width: "8%",
            render: (text: string) => <div className="text-gray-400 text-center">{text}</div>
        },
        {
            title: "Price (Default)",
            dataIndex: "rate",
            width: "10%",
            render: (_text: any, record: any) => (
                <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    value={record.rate}
                    onChange={(val) => handleItemChange(record.key, "rate", val)}
                />
            )
        },
        {
            title: "Tax",
            dataIndex: "tax",
            width: "12%",
            render: (_text: any, record: any) => (
                <Select value={record.tax} onChange={(val) => handleItemChange(record.key, "tax", val)} style={{ width: '100%' }}>
                    <Option value={0}>None (0%)</Option>
                    <Option value={5}>GST 5%</Option>
                    <Option value={12}>GST 12%</Option>
                    <Option value={18}>GST 18%</Option>
                    <Option value={28}>GST 28%</Option>
                </Select>
            )
        },
        {
            title: "Amount",
            key: "amount",
            width: "10%",
            render: (_text: any, record: any) => {
                const amount = record.quantity * record.rate;
                const afterDisc1 = amount * (1 - (record.discount1 || 0) / 100);
                const net = afterDisc1 * (1 - (record.discount2 || 0) / 100);
                return <Text strong>₹{net.toFixed(2)}</Text>;
            }
        },
        {
            title: "",
            key: "action",
            width: "4%",
            render: (_: any, record: any) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
            )
        }
    ];


    return (
        <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '0 0 40px 0' }}>
            {/* Top Navigation Bar */}
            <div className="bg-slate-900 text-white flex justify-between items-center px-4 py-3" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <div className="flex items-center gap-3">
                    <Button type="text" onClick={() => navigate(-1)} icon={<LeftOutlined style={{ color: '#fff' }} />} />
                    <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 500 }}><Form.Item name="title" noStyle><Input variant="borderless" placeholder="Order Confirmation" disabled style={{ color: '#fff', padding: 0, fontSize: '18px', width: '300px' }}/></Form.Item>Order Confirmation</Title>
                </div>
                <div className="flex items-center gap-4">
                    <Text style={{ color: '#bfbfbf', fontSize: '12px' }}>Buyer ID: {buyerId || 'N/A'}</Text>
                    <Select defaultValue="inr" size="small" style={{ width: 80 }} popupMatchSelectWidth={false}>
                        <Option value="inr">INR - ₹</Option>
                        <Option value="usd">USD - $</Option>
                    </Select>
                    <Button type="primary" danger ghost icon={<CloseOutlined />} size="small" onClick={() => navigate(-1)}>
                        Cancel
                    </Button>
                </div>
            </div>

            <Form form={form} layout="vertical" style={{ padding: '16px 24px' }}>
                {/* 3 Column Layout */}
                <Row gutter={16}>
                    {/* Column 1: Buyer Details */}
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">My Company Details</div>} extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600" />} onClick={() => setIsBuyerDrawerOpen(true)} />} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <div className="mb-4"><Text strong className="text-[15px] text-slate-800">{buyerDetails.companyName}</Text><div className="text-slate-500 text-[12px] mt-1">GSTIN: <span className="text-slate-700 font-medium">{buyerDetails.gstin}</span></div></div>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group">
                                    <div className="flex justify-between items-start mb-1"><Text className="text-slate-600 text-[13px] font-medium">Billing Address</Text><Button type="text" size="small" className="h-auto p-0 opacity-0 group-hover:opacity-100 transition-opacity" icon={<EditOutlined className="text-slate-400 hover:text-blue-600" />} onClick={() => setIsUserAddressDrawerOpen(true)} /></div>
                                    <Text className="text-slate-500 text-[12px] leading-relaxed block">{userAddress.address1}<br/>{userAddress.city} ({userAddress.state})<br/>{userAddress.country} - {userAddress.pincode}</Text>
                                </div>
                                <div className="flex justify-end mt-4 pt-3 border-t border-slate-100"><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'company' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => setPlaceOfSupplySource('company')}>{placeOfSupplySource === 'company' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                            </Card>
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white flex-1" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Buyer Details</div>} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <div className="flex justify-between items-start mb-2">
                                    <Form.Item name="buyer_id" noStyle rules={[{ required: true, message: 'Select Buyer' }]}>
                                        <Select 
                                            placeholder="Select Buyer" 
                                            style={{ width: '60%' }}
                                            showSearch
                                            optionFilterProp="children"
                                        >
                                            {buyers.map(b => (
                                                <Option key={b.id} value={b.id}>{b.name}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                    <Tag color="blue" className="text-xs m-0">GSTIN: {selectedBuyer?.gstin || 'N/A'}</Tag>
                                </div>
                                
                                <div className="text-xs text-slate-500 leading-relaxed mt-4">
                                    {selectedBuyer?.address ? (
                                        <>
                                            {selectedBuyer.address}<br />
                                            {selectedBuyer.city}, {selectedBuyer.state}<br />
                                            {selectedBuyer.country || 'India'} - {selectedBuyer.pincode}
                                        </>
                                    ) : (
                                        <span className="text-gray-400">Select a buyer to load address details.</span>
                                    )}
                                </div>
                                <div className="flex justify-end mt-4 pt-3 border-t border-slate-100"><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'buyer' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => setPlaceOfSupplySource('buyer')}>{placeOfSupplySource === 'buyer' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                            </Card>
                        </div>
                    </Col>
                    
                    {/* Column 2: Delivery & Place of Supply */}
                    <Col span={8}>
                        <div className="flex flex-col gap-4 h-full">
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide">Delivery Location</div>} extra={<Button type="text" size="small" icon={<EditOutlined className="text-slate-400 hover:text-blue-600"/>} onClick={() => setIsDeliveryLocationDrawerOpen(true)} />} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <Text strong className="text-[14px] text-slate-800">{deliveryLocation.locationName || 'Main'}</Text>
                                <Text className="text-slate-500 text-[12px] leading-relaxed block mt-2">{deliveryLocation.address1 || "Main Address,"}<br/>{deliveryLocation.city || "Mumbai"} ({deliveryLocation.state || "Maharashtra"})<br/>{deliveryLocation.country || "India"} - {deliveryLocation.pincode || "400001"}</Text>
                                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100"><Text className="text-slate-500 text-[12px] font-medium">GSTIN : <span className="text-slate-400">{deliveryLocation.gstin || "Not provided"}</span></Text><Button type="link" size="small" className={`p-0 text-xs font-medium ${placeOfSupplySource === 'delivery' ? 'text-green-600 font-bold' : 'text-blue-600'}`} onClick={() => setPlaceOfSupplySource('delivery')}>{placeOfSupplySource === 'delivery' ? '✓ Place of Supply (Active)' : 'Place of Supply'}</Button></div>
                            </Card>
                            <Card size="small" className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white flex-1" title={<div className="text-slate-700 font-semibold text-[13px] uppercase tracking-wide flex items-center gap-2">Place Of Supply <Tag color={placeOfSupplySource === 'buyer' ? 'blue' : 'green'} className="text-[10px] m-0 border-0">{placeOfSupplySource === 'buyer' ? 'From Buyer' : 'From Delivery'}</Tag></div>} styles={{ header: { backgroundColor: '#fcfcfd', borderBottom: '1px solid #f1f5f9', padding: '12px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}>
                                <Form.Item name="city" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">City <span className="text-red-500">*</span></span>} style={{ marginBottom: 16 }}><Input className="rounded-lg border-gray-300" /></Form.Item>
                                <Row gutter={16}><Col span={12}><Form.Item name="state" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">State <span className="text-red-500">*</span></span>} style={{ marginBottom: 0 }}><Select options={[{value: 'Maharashtra', label: 'Maharashtra'}, {value: 'Gujarat', label: 'Gujarat'}, {value: 'Delhi', label: 'Delhi'}, {value: 'Karnataka', label: 'Karnataka'}, {value: 'Tamil Nadu', label: 'Tamil Nadu'}]} /></Form.Item></Col><Col span={12}><Form.Item name="country" label={<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Country <span className="text-red-500">*</span></span>} style={{ marginBottom: 0 }}><Select options={[{value: 'India', label: 'India'}]} /></Form.Item></Col></Row>
                            </Card>
                        </div>
                    </Col>
                    
                    {/* Column 3: Primary Document Details */}
                    <Col span={8}>
                        <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm h-[400px]">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                <Text className="text-xs font-semibold text-blue-600 tracking-wider">PRIMARY DOCUMENT DETAILS</Text>
                                <Button type="link" size="small" className="text-xs">Show Optional Fields</Button>
                            </div>

                            <Form.Item name="title" label={<span className="text-xs">TITLE <span className="text-red-500">*</span></span>} className="mb-3">
                                <Input defaultValue={`Order Confirmation dated ${new Date().toLocaleDateString('en-GB')}`} size="small" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="doc_number" label={<span className="text-xs text-blue-500">DOCUMENT NUMBER <span className="text-red-500">*</span></span>} rules={[{ required: true }]} className="mb-3">
                                        <Input placeholder="OC-0001" size="small" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="doc_date" label={<span className="text-xs text-gray-500">DOCUMENT DATE</span>} className="mb-3">
                                        <DatePicker size="small" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="amendment" label={<span className="text-xs text-gray-500">AMENDMENT</span>} className="mb-3">
                                        <InputNumber size="small" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="delivery_date" label={<span className="text-xs text-gray-500">DELIVERY DATE <span className="text-red-500">*</span></span>} className="mb-3">
                                        <DatePicker size="small" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="store" label={<span className="text-xs text-gray-500">STORE <span className="text-red-500">*</span></span>} className="mb-0 mt-2">
                                <Select size="small">
                                    <Option value="Default Stock Store">Default Stock Store</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    </Col>
                </Row>

                {/* Main Items Section */}
                <div className="bg-white rounded-md border border-gray-200 mt-4 shadow-sm">
                    {/* Action Bar */}
                    <div className="flex justify-between items-center p-3 border-b border-gray-100">
                        <Space>
                            <Button size="small" icon={<DownloadOutlined />}>Download Item Template</Button>
                            <Button size="small" icon={<UploadOutlined />}>Bulk Upload</Button>
                        </Space>
                        <Space>
                            <span className="text-xs text-gray-500">Price type</span>
                            <Select size="small" defaultValue="default" style={{ width: 120 }}>
                                <Option value="default">Default Price</Option>
                            </Select>
                            <Select size="small" defaultValue="optional" style={{ width: 150 }} disabled>
                                <Option value="optional">Optional Columns</Option>
                            </Select>
                            <Input size="small" placeholder="Search with Id or..." prefix={<SettingOutlined />} style={{ width: 150 }} />
                        </Space>
                    </div>

                    {/* Table */}
                    <Table
                        columns={columns}
                        dataSource={dataSource}
                        pagination={false}
                        bordered={false}
                        size="small"
                        rowClassName={() => 'border-b border-gray-100 align-top'}
                        className="document-items-table custom-header-table"
                    />

                    <div className="p-3 border-b border-gray-100" style={{ backgroundColor: '#fafafa' }}>
                        <Button type="primary" size="small" onClick={handleAddItem} icon={<PlusOutlined />} className="bg-blue-500 hover:bg-blue-600 border-none px-4">
                            ADD ITEM
                        </Button>
                    </div>

                    {/* Footer Layout: Tabs & Totals */}
                    <Row>
                        <Col span={16} className="border-r border-gray-100">
                            <DocumentTabsSection
                                mode="create"
                                value={documentTabsData}
                                onChange={setDocumentTabsData}
                            />
                        </Col>
                        {/* Totals Section */}
                        <Col span={8} className="p-4 pl-8 bg-[#fafafa]">
                            <div className="flex justify-between items-center mb-3 text-sm">
                                <Text className="text-gray-600">Additional Discount</Text>
                                <Select size="small" defaultValue="select" style={{ width: 80 }}>
                                    <Option value="select">select</Option>
                                </Select>
                            </div>
                            {calculations.totalDiscount > 0 && (
                                <div className="flex justify-between mb-2 text-sm"><Text className="text-orange-500">Item Discounts :</Text><Text strong className="text-orange-500">- ₹{Math.abs(calculations.totalDiscount).toFixed(2)}</Text></div>
                            )}
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <Text className="text-gray-600">Total (before tax) :</Text>
                                <Text className="font-semibold">₹{calculations.totalBeforeTax.toFixed(2)}</Text>
                            </div>
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <div><Tag className={`mr-2 border ${rcmEnabled ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-blue-200 text-blue-500 bg-white'} cursor-pointer`} onClick={() => setRcmEnabled(!rcmEnabled)}>RCM {rcmEnabled && '✓'}</Tag><Text className="text-gray-600">Total Tax :</Text></div>
                                <Text className="font-semibold">₹{calculations.totalTax.toFixed(2)}</Text>
                            </div>
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <Text className="text-gray-600">Total (after tax) :</Text>
                                <Text className="font-semibold">₹{calculations.totalAfterTax.toFixed(2)}</Text>
                            </div>
                            <div className="flex justify-between items-center mb-4 text-sm">
                                <div><Tag className={`mr-2 border ${roundOffEnabled ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-200 bg-white'} cursor-pointer`} onClick={() => setRoundOffEnabled(!roundOffEnabled)}>Round-off {roundOffEnabled && '✓'}</Tag><Text className="text-gray-800 font-bold">Grand Total :</Text></div>
                                <Text className="font-bold text-lg">₹{calculations.grandTotal.toFixed(2)}</Text>
                            </div>
                            <Divider className="my-2" />
                            <div className="flex justify-between items-center text-sm">
                                <Text className="text-gray-600">Advance To Pay :</Text>
                                <span className="border-b border-gray-300 pb-1 flex justify-between w-24">
                                    <span>₹</span> <span>0.00</span>
                                </span>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 flex justify-end gap-3 px-2">
                    <Button 
                        size="large" 
                        className="font-semibold" 
                        onClick={() => handleSave("draft")} 
                        loading={loading}
                    >
                        SAVE DRAFT
                    </Button>
                    <Button 
                        type="primary" 
                        size="large" 
                        className="font-semibold bg-blue-600 px-8" 
                        onClick={() => handleSave("created")} 
                        loading={loading}
                    >
                        SAVE AND SEND
                    </Button>
                </div>
            </Form>

            <BuyerDetailsDrawer open={isBuyerDrawerOpen} onClose={() => setIsBuyerDrawerOpen(false)} buyer={buyerDetails} onSave={setBuyerDetails} />
            <DeliveryLocationDrawer open={isDeliveryLocationDrawerOpen} onClose={() => setIsDeliveryLocationDrawerOpen(false)} deliveryLocation={deliveryLocation} onSave={setDeliveryLocation} />
            <UserAddressDrawer open={isUserAddressDrawerOpen} onClose={() => setIsUserAddressDrawerOpen(false)} addressData={userAddress} onSave={setUserAddress} />

            <style>{`
                .document-items-table .ant-table-thead > tr > th { 
                    background-color: #f8fbff; 
                    color: #008b8b; 
                    font-weight: 600; 
                    font-size: 12px;
                    border-bottom: 2px solid #e6f0ff;
                }
                .document-items-table .ant-select-selector, .document-items-table .ant-input, .document-items-table .ant-input-number {
                    border-radius: 4px;
                }
                .custom-footer-tabs .ant-tabs-nav::before {
                    border-bottom: none;
                }
                .custom-footer-tabs .ant-tabs-tab {
                    padding: 4px 12px;
                    background: #f0f2f5;
                    border-radius: 16px;
                    margin-right: 8px !important;
                    border: 1px solid #d9d9d9;
                }
                .custom-footer-tabs .ant-tabs-tab-active {
                    background: #e6f4ff;
                    border-color: #91caff;
                }
                .custom-footer-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
                    color: #1677ff !important;
                }
            `}</style>
        </div>
    );
}
