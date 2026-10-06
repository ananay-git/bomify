import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, InputNumber, Button, Row, Col, Divider, Typography } from 'antd';
import { message } from '@/lib/antdHelper';
import { SaveOutlined } from "@ant-design/icons";
import { inventoryApi, ItemCreatePayload } from "@/features/inventory/api";

const { Text } = Typography;
const { Option } = Select;

interface AddItemModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const UOM_OPTIONS = [
    "Kg",
    "g",
    "Liter",
    "ml",
    "Meter",
    "cm",
    "Piece",
    "Box",
    "Dozen",
    "Ton",
    "Bag",
    "Roll",
];

const TAX_OPTIONS = [
    { label: "None", value: 0 },
    { label: "GST 5%", value: 5 },
    { label: "GST 12%", value: 12 },
    { label: "GST 18%", value: 18 },
    { label: "GST 28%", value: 28 },
];

export default function AddItemModal({ open, onClose, onSuccess }: AddItemModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [nextSku, setNextSku] = useState("");

    useEffect(() => {
        if (open) {
            inventoryApi.getNextSku().then((sku) => {
                setNextSku(sku);
                form.setFieldsValue({ sku });
            }).catch(() => {});
            form.resetFields();
        }
    }, [open, form]);

    const handleSave = async (andNew = false) => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            const payload: ItemCreatePayload = {
                sku: values.sku,
                name: values.name,
                product_service: values.product_service || "product",
                buy_sell: values.buy_sell || "buy",
                unit_of_measure: values.unit_of_measure,
                category: values.category || null,
                current_stock: values.current_stock || 0,
                default_price: values.default_price || 0,
                hsn_code: values.hsn_code || undefined,
                tax: values.tax ?? 0,
                min_stock_level: values.min_stock_level || 0,
                max_stock_level: values.max_stock_level || 0,
                regular_buying_price: values.regular_buying_price || 0,
                wholesale_buying_price: values.wholesale_buying_price || 0,
                regular_selling_price: values.regular_selling_price || 0,
                wholesale_selling_price: values.wholesale_selling_price || 0,
            };
            await inventoryApi.create(payload);
            message.success("Item created successfully!");
            onSuccess();
            if (andNew) {
                form.resetFields();
                const newSku = await inventoryApi.getNextSku();
                setNextSku(newSku);
                form.setFieldsValue({ sku: newSku });
            } else {
                onClose();
            }
        } catch (err: any) {
            if (err?.response?.data?.detail) {
                message.error(err.response.data.detail);
            } else if (err?.errorFields) {
                // form validation error - antd handles it
            } else {
                message.error("Failed to create item");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={null}
            footer={null}
            width={720}
            destroyOnHidden
            styles={{ body: { padding: "0 24px 24px" } }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "20px 0 16px",
                }}
            >
                <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                    Add Item
                </Typography.Title>
            </div>

            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    product_service: "product",
                    buy_sell: "buy",
                    sku: nextSku,
                }}
                size="middle"
            >
                {/* Row 1 - Item Id & Item Name */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Item Id <span style={{ color: "#ff4d4f" }}>*</span>
                                </Text>
                            }
                            name="sku"
                            rules={[{ required: true, message: "Item Id is required" }]}
                        >
                            <Input placeholder="e.g. SKU00001" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Item Name <span style={{ color: "#ff4d4f" }}>*</span>
                                </Text>
                            }
                            name="name"
                            rules={[{ required: true, message: "Item Name is required" }]}
                        >
                            <Input placeholder="Enter item name" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Row 2 - Product/Service & Buy/Sell/Both */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Product/Service <span style={{ color: "#ff4d4f" }}>*</span>
                                </Text>
                            }
                            name="product_service"
                            rules={[{ required: true }]}
                        >
                            <Select>
                                <Option value="product">Product</Option>
                                <Option value="service">Service</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Buy/Sell/Both <span style={{ color: "#ff4d4f" }}>*</span>
                                </Text>
                            }
                            name="buy_sell"
                            rules={[{ required: true }]}
                        >
                            <Select>
                                <Option value="buy">Buy</Option>
                                <Option value="sell">Sell</Option>
                                <Option value="both">Both</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                {/* Row 3 - UoM & Item Category */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Unit of Measurement (UoM){" "}
                                    <span style={{ color: "#ff4d4f" }}>*</span>
                                </Text>
                            }
                            name="unit_of_measure"
                            rules={[
                                { required: true, message: "Unit of measurement is required" },
                            ]}
                        >
                            <Select placeholder="Select" showSearch allowClear>
                                {UOM_OPTIONS.map((u) => (
                                    <Option key={u} value={u}>
                                        {u}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Item Category
                                </Text>
                            }
                            name="category"
                        >
                            <Select placeholder="Select" allowClear>
                                <Option value="raw_material">Raw Material</Option>
                                <Option value="finished_good">Finished Good</Option>
                                <Option value="packaging">Packaging</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                {/* Row 4 - Current Stock & Default Price */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Current Stock
                                </Text>
                            }
                            name="current_stock"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                placeholder="0"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Default Price
                                </Text>
                            }
                            name="default_price"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                prefix="₹"
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Row 5 - HSN Code & Tax */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    HSN Code
                                </Text>
                            }
                            name="hsn_code"
                        >
                            <Input placeholder="Enter HSN code" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Tax
                                </Text>
                            }
                            name="tax"
                        >
                            <Select placeholder="Select tax" allowClear>
                                {TAX_OPTIONS.map((t) => (
                                    <Option key={t.value} value={t.value}>
                                        {t.label}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                {/* Row 6 - Min / Max Stock Level */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Minimum Stock Level
                                </Text>
                            }
                            name="min_stock_level"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                placeholder="0"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text strong style={{ fontSize: 13 }}>
                                    Maximum Stock Level
                                </Text>
                            }
                            name="max_stock_level"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                placeholder="0"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider style={{ margin: "8px 0 16px" }} />

                {/* Pricing Section */}
                <Typography.Text
                    strong
                    style={{ fontSize: 14, display: "block", marginBottom: 12 }}
                >
                    Pricing
                </Typography.Text>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={<Text style={{ fontSize: 13 }}>Regular Buying Price</Text>}
                            name="regular_buying_price"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                prefix="₹"
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text style={{ fontSize: 13 }}>Wholesale Buying Price</Text>
                            }
                            name="wholesale_buying_price"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                prefix="₹"
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text style={{ fontSize: 13 }}>Regular Selling Price</Text>
                            }
                            name="regular_selling_price"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                prefix="₹"
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={
                                <Text style={{ fontSize: 13 }}>Wholesale Selling Price</Text>
                            }
                            name="wholesale_selling_price"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                prefix="₹"
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Footer Buttons */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 12,
                        marginTop: 8,
                    }}
                >
                    <Button
                        icon={<SaveOutlined />}
                        onClick={() => handleSave(false)}
                        loading={loading}
                        size="large"
                    >
                        Save
                    </Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={() => handleSave(true)}
                        loading={loading}
                        size="large"
                        style={{ background: "#008b8b" }}
                    >
                        Save &amp; Add New
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
