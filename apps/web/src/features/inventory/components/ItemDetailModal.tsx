import { useState } from "react";
import { Modal, Typography, Tag, Button, Space, Row, Col, Table, Divider, Form, Input, InputNumber, Select, Tabs } from 'antd';
import { message } from '@/lib/antdHelper';
import {
    ArrowLeftOutlined,
    DeleteOutlined,
    CopyOutlined,
    EditOutlined,
} from "@ant-design/icons";
import { inventoryApi, InventoryItem } from "@/features/inventory/api";

const { Title, Text } = Typography;
const { Option } = Select;

interface ItemDetailModalProps {
    open: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onUpdated: () => void;
}

const formatCurrency = (val: number) =>
    `₹${(val || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const TAX_OPTIONS = [
    { label: "None", value: 0 },
    { label: "GST 5%", value: 5 },
    { label: "GST 12%", value: 12 },
    { label: "GST 18%", value: 18 },
    { label: "GST 28%", value: 28 },
];

const UOM_OPTIONS = [
    "Kg", "g", "Liter", "ml", "Meter", "cm", "Piece", "Box", "Dozen", "Ton", "Bag", "Roll",
];

/* ── label / value pair used throughout ── */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: "#8c8c8c", display: "block" }}>
                {label}:
            </Text>
            <Text strong style={{ fontSize: 14, color: "#262626" }}>
                {value || "—"}
            </Text>
        </div>
    );
}

/* ── section header line (teal text + dashed border) ── */
function SectionHeader({
    title,
    extra,
}: {
    title: string;
    extra?: React.ReactNode;
}) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px dashed #d9d9d9",
                paddingBottom: 8,
                marginBottom: 20,
                marginTop: 28,
            }}
        >
            <Text strong style={{ color: "#008b8b", fontSize: 14 }}>
                {title}
            </Text>
            {extra}
        </div>
    );
}

export default function ItemDetailModal({
    open,
    item,
    onClose,
    onUpdated,
}: ItemDetailModalProps) {
    const [editingBasic, setEditingBasic] = useState(false);
    const [editingPrices, setEditingPrices] = useState(false);
    const [saving, setSaving] = useState(false);
    const [basicForm] = Form.useForm();
    const [priceForm] = Form.useForm();
    const [activeSection, setActiveSection] = useState("primary");

    if (!item) return null;

    const totalStockValue = (item.current_stock || 0) * (item.default_price || 0);

    const categoryLabel = item.category
        ? item.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "";

    /* ── save basic details ── */
    const handleSaveBasic = async () => {
        try {
            const vals = await basicForm.validateFields();
            setSaving(true);
            await inventoryApi.update(item.id, {
                sku: vals.sku,
                name: vals.name,
                buy_sell: vals.buy_sell,
                category: vals.category || null,
                unit_of_measure: vals.unit_of_measure,
                tax: vals.tax ?? 0,
                hsn_code: vals.hsn_code || null,
            });
            message.success("Basic details updated");
            setEditingBasic(false);
            onUpdated();
        } catch {
            message.error("Failed to update");
        } finally {
            setSaving(false);
        }
    };

    /* ── save prices ── */
    const handleSavePrices = async () => {
        try {
            const vals = await priceForm.validateFields();
            setSaving(true);
            await inventoryApi.update(item.id, {
                default_price: vals.default_price ?? 0,
                regular_buying_price: vals.regular_buying_price ?? 0,
                wholesale_buying_price: vals.wholesale_buying_price ?? 0,
                regular_selling_price: vals.regular_selling_price ?? 0,
                wholesale_selling_price: vals.wholesale_selling_price ?? 0,
            });
            message.success("Prices updated");
            setEditingPrices(false);
            onUpdated();
        } catch {
            message.error("Failed to update prices");
        } finally {
            setSaving(false);
        }
    };

    /* ── left sidebar navigation ── */
    const sidebarItems = [
        { key: "primary", label: "Primary Item Details" },
        { key: "stock", label: "Stock in all units" },
        { key: "minmax", label: "Min/Max Levels" },
        { key: "attachments", label: "Attachments" },
    ];

    /* ── primary item details pane ── */
    const renderPrimaryDetails = () => (
        <>
            {/* BASIC ITEM DETAILS */}
            <Title level={5} style={{ fontWeight: 700, marginBottom: 16 }}>
                Primary Item Details
            </Title>

            <SectionHeader
                title="Basic Item Details"
                extra={
                    !editingBasic ? (
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            style={{ color: "#008b8b", fontWeight: 500 }}
                            onClick={() => {
                                basicForm.setFieldsValue({
                                    sku: item.sku,
                                    name: item.name,
                                    buy_sell: item.buy_sell,
                                    category: item.category,
                                    unit_of_measure: item.unit_of_measure,
                                    tax: item.tax,
                                    hsn_code: item.hsn_code,
                                });
                                setEditingBasic(true);
                            }}
                        >
                            Edit Basic Item Details
                        </Button>
                    ) : (
                        <Space>
                            <Button size="small" onClick={() => setEditingBasic(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                loading={saving}
                                onClick={handleSaveBasic}
                                style={{ background: "#008b8b" }}
                            >
                                Save
                            </Button>
                        </Space>
                    )
                }
            />

            {!editingBasic ? (
                <>
                    <Row gutter={[48, 20]}>
                        <Col span={6}>
                            <Field label="Item Id" value={item.sku} />
                        </Col>
                        <Col span={6}>
                            <Field label="Item Name" value={item.name} />
                        </Col>
                        <Col span={6}>
                            <Field
                                label="Type"
                                value={
                                    item.buy_sell
                                        ? item.buy_sell.charAt(0).toUpperCase() +
                                          item.buy_sell.slice(1)
                                        : ""
                                }
                            />
                        </Col>
                        <Col span={6}>
                            <Field label="Item Category" value={categoryLabel} />
                        </Col>
                    </Row>
                    <Row gutter={[48, 20]} style={{ marginTop: 16 }}>
                        <Col span={6}>
                            <Field label="Base Unit" value={item.unit_of_measure} />
                        </Col>
                        <Col span={6}>
                            <Field
                                label="Tax"
                                value={item.tax ? `${item.tax}%` : ""}
                            />
                        </Col>
                        <Col span={6}>
                            <Field label="Hsn Code" value={item.hsn_code} />
                        </Col>
                    </Row>
                </>
            ) : (
                <Form form={basicForm} layout="vertical" size="small">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="SKU" name="sku" rules={[{ required: true, message: 'SKU is required' }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Item Name" name="name" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Type (Buy/Sell/Both)" name="buy_sell">
                                <Select>
                                    <Option value="buy">Buy</Option>
                                    <Option value="sell">Sell</Option>
                                    <Option value="both">Both</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Item Category" name="category">
                                <Select allowClear placeholder="Select">
                                    <Option value="raw_material">Raw Material</Option>
                                    <Option value="finished_good">Finished Good</Option>
                                    <Option value="packaging">Packaging</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="Base Unit (UoM)" name="unit_of_measure" rules={[{ required: true }]}>
                                <Select showSearch>
                                    {UOM_OPTIONS.map((u) => (
                                        <Option key={u} value={u}>{u}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Tax" name="tax">
                                <Select allowClear>
                                    {TAX_OPTIONS.map((t) => (
                                        <Option key={t.value} value={t.value}>{t.label}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="HSN Code" name="hsn_code">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            )}

            {/* ITEM PRICES */}
            <SectionHeader
                title="Item Prices"
                extra={
                    !editingPrices ? (
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            style={{ color: "#008b8b", fontWeight: 500 }}
                            onClick={() => {
                                priceForm.setFieldsValue({
                                    default_price: item.default_price,
                                    regular_buying_price: item.regular_buying_price,
                                    wholesale_buying_price: item.wholesale_buying_price,
                                    regular_selling_price: item.regular_selling_price,
                                    wholesale_selling_price: item.wholesale_selling_price,
                                });
                                setEditingPrices(true);
                            }}
                        >
                            Edit Item Prices
                        </Button>
                    ) : (
                        <Space>
                            <Button size="small" onClick={() => setEditingPrices(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                loading={saving}
                                onClick={handleSavePrices}
                                style={{ background: "#008b8b" }}
                            >
                                Save
                            </Button>
                        </Space>
                    )
                }
            />

            {!editingPrices ? (
                <>
                    <Row gutter={[48, 20]}>
                        <Col span={6}>
                            <Field
                                label="Default Price"
                                value={formatCurrency(item.default_price)}
                            />
                        </Col>
                        <Col span={6}>
                            <Field
                                label="Regular Buying Price"
                                value={formatCurrency(item.regular_buying_price)}
                            />
                        </Col>
                        <Col span={6}>
                            <Field
                                label="Wholesale Buying Price"
                                value={formatCurrency(item.wholesale_buying_price)}
                            />
                        </Col>
                        <Col span={6}>
                            <Field
                                label="Regular Selling Price"
                                value={formatCurrency(item.regular_selling_price)}
                            />
                        </Col>
                    </Row>
                    <Row gutter={[48, 20]} style={{ marginTop: 16 }}>
                        <Col span={6}>
                            <Field
                                label="Wholesale Selling Price"
                                value={formatCurrency(item.wholesale_selling_price)}
                            />
                        </Col>
                    </Row>
                </>
            ) : (
                <Form form={priceForm} layout="vertical" size="small">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="Default Price" name="default_price">
                                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Regular Buying Price" name="regular_buying_price">
                                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Wholesale Buying Price" name="wholesale_buying_price">
                                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="Regular Selling Price" name="regular_selling_price">
                                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Wholesale Selling Price" name="wholesale_selling_price">
                                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            )}
        </>
    );

    /* ── stock in all units pane ── */
    const renderStockSection = () => (
        <>
            <Title level={5} style={{ fontWeight: 700, marginBottom: 16 }}>
                Stock in all units
            </Title>
            <Text style={{ fontSize: 13, color: "#595959" }}>
                Base Unit: <Text strong>{item.unit_of_measure}</Text>
            </Text>
            <Table
                style={{ marginTop: 16 }}
                size="small"
                pagination={false}
                dataSource={[
                    {
                        key: "1",
                        stock: `${item.current_stock} ${item.unit_of_measure}`,
                        pricePerUnit: formatCurrency(item.default_price),
                    },
                ]}
                columns={[
                    {
                        title: "Stock:",
                        dataIndex: "stock",
                        key: "stock",
                        width: 200,
                    },
                    {
                        title: "Price Per Unit:",
                        dataIndex: "pricePerUnit",
                        key: "pricePerUnit",
                        width: 200,
                    },
                ]}
            />
        </>
    );

    /* ── min/max levels pane ── */
    const renderMinMaxSection = () => (
        <>
            <Title level={5} style={{ fontWeight: 700, marginBottom: 16 }}>
                Min/Max Stock Levels
            </Title>
            <Row gutter={[48, 16]}>
                <Col span={8}>
                    <Field
                        label="Minimum Stock Level"
                        value={item.min_stock_level || 0}
                    />
                </Col>
                <Col span={8}>
                    <Field
                        label="Maximum Stock Level"
                        value={item.max_stock_level || 0}
                    />
                </Col>
                <Col span={8}>
                    <Field
                        label="Reorder Level"
                        value={item.reorder_level || 0}
                    />
                </Col>
            </Row>
        </>
    );

    const renderActiveSection = () => {
        switch (activeSection) {
            case "primary":
                return renderPrimaryDetails();
            case "stock":
                return renderStockSection();
            case "minmax":
                return renderMinMaxSection();
            case "attachments":
                return (
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <Text style={{ color: "#8c8c8c" }}>No attachments yet.</Text>
                    </div>
                );
            default:
                return renderPrimaryDetails();
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={1100}
            destroyOnHidden
            title={null}
            styles={{
                body: { padding: 0 },
            }}
        >
            {/* ── TOP HEADER ── */}
            <div
                style={{
                    padding: "16px 24px",
                    background: "#fffaf0",
                    borderBottom: "1px solid #f0e6d2",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Space size="middle" align="center">
                    <ArrowLeftOutlined
                        onClick={onClose}
                        style={{ fontSize: 16, cursor: "pointer", color: "#595959" }}
                    />
                    <div>
                        <Title level={5} style={{ margin: 0, fontWeight: 700 }}>
                            {item.name}
                        </Title>
                        <Tag
                            style={{
                                marginTop: 4,
                                background: "#262626",
                                color: "#fff",
                                borderRadius: 4,
                                fontSize: 11,
                                padding: "0 8px",
                                border: "none",
                            }}
                        >
                            {item.product_service === "product" ? "Product" : "Service"}
                        </Tag>
                    </div>
                </Space>
                <Space size="middle">
                    <div
                        style={{
                            border: "1px solid #008b8b",
                            borderRadius: 6,
                            padding: "8px 20px",
                            textAlign: "center",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                color: "#8c8c8c",
                                display: "block",
                                letterSpacing: 1,
                            }}
                        >
                            TOTAL STOCK
                        </Text>
                        <Space split={<Divider type="vertical" />}>
                            <Text
                                strong
                                style={{ color: "#008b8b", fontSize: 16 }}
                            >
                                {item.current_stock} {item.unit_of_measure}
                            </Text>
                            <Text strong style={{ fontSize: 14 }}>
                                {formatCurrency(totalStockValue)}
                            </Text>
                        </Space>
                    </div>
                    <Button icon={<CopyOutlined />}>Duplicate</Button>
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        style={{ borderColor: "#ff4d4f" }}
                    />
                </Space>
            </div>

            {/* ── TABS BAR ── */}
            <Tabs
                defaultActiveKey="details"
                style={{ padding: "0 24px" }}
                items={[
                    { key: "details", label: "Item Details" },
                    { key: "history", label: "Item History" },
                    { key: "batches", label: "View Batches" },
                ]}
            />

            {/* ── BODY with left sidebar + content ── */}
            <div style={{ display: "flex", minHeight: 500 }}>
                {/* Left sidebar nav */}
                <div
                    style={{
                        width: 180,
                        borderRight: "1px solid #f0f0f0",
                        padding: "16px 0",
                        flexShrink: 0,
                    }}
                >
                    {sidebarItems.map((s) => (
                        <div
                            key={s.key}
                            onClick={() => setActiveSection(s.key)}
                            style={{
                                padding: "10px 20px",
                                cursor: "pointer",
                                fontSize: 13,
                                color:
                                    activeSection === s.key ? "#008b8b" : "#595959",
                                fontWeight:
                                    activeSection === s.key ? 600 : 400,
                                borderLeft:
                                    activeSection === s.key
                                        ? "3px solid #008b8b"
                                        : "3px solid transparent",
                                background:
                                    activeSection === s.key
                                        ? "#f0fffe"
                                        : "transparent",
                                transition: "all 0.2s",
                            }}
                        >
                            {s.label}
                        </div>
                    ))}
                </div>

                {/* Main content area */}
                <div style={{ flex: 1, padding: "16px 32px 32px" }}>
                    {renderActiveSection()}
                </div>
            </div>
        </Modal>
    );
}
