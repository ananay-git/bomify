import { useState, useEffect } from "react";
import { Modal, Form, InputNumber, Select, Input, Typography, Space } from "antd";
import { inventoryApi, InventoryItem } from "../api";
import { extractApiError } from "@/lib/errors";
import { message } from "@/lib/antdHelper";

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface AdjustStockModalProps {
    open: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AdjustStockModal({ open, item, onClose, onSuccess }: AdjustStockModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && item) {
            form.resetFields();
            form.setFieldsValue({
                transaction_type: "in",
                quantity: 1,
            });
        }
    }, [open, item, form]);

    const handleSubmit = async () => {
        if (!item) return;
        try {
            const values = await form.validateFields();
            setLoading(true);

            await inventoryApi.addTransaction({
                item_id: item.id,
                transaction_type: values.transaction_type as "in" | "out" | "adjustment",
                quantity: values.quantity,
                notes: values.notes,
                reference_type: "manual_adjustment",
            });

            message.success("Stock updated successfully");
            onSuccess();
            onClose();
        } catch (error: any) {
            if (error.errorFields) return; // Validation failed
            message.error(extractApiError(error, "Failed to update stock"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Adjust Stock"
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Update Stock"
            destroyOnClose
        >
            {item && (
                <div style={{ marginBottom: 16 }}>
                    <Text strong>{item.name}</Text> (SKU: {item.sku})<br />
                    <Text type="secondary">Current Stock: {item.current_stock} {item.unit_of_measure}</Text>
                </div>
            )}
            
            <Form form={form} layout="vertical">
                <Space style={{ display: 'flex' }} align="start">
                    <Form.Item
                        name="transaction_type"
                        label="Action"
                        rules={[{ required: true, message: "Required" }]}
                        style={{ width: 140 }}
                    >
                        <Select>
                            <Option value="in">Increase (Add)</Option>
                            <Option value="out">Decrease (Remove)</Option>
                            <Option value="adjustment">Set Exact</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="quantity"
                        label="Quantity"
                        rules={[
                            { required: true, message: "Required" },
                            { type: "number", min: 0.01, message: "Must be > 0" }
                        ]}
                    >
                        <InputNumber style={{ width: 150 }} />
                    </Form.Item>
                </Space>

                <Form.Item
                    name="notes"
                    label="Reason / Notes"
                >
                    <TextArea rows={3} placeholder="E.g., Physical stock mismatch..." />
                </Form.Item>
            </Form>
        </Modal>
    );
}
