import { useEffect, useState } from "react";
import {
  Modal, Form, Select, InputNumber, Button, message, DatePicker, Typography, Tag,
} from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { workOrderApi, bomApi, BOM } from "@/features/production/api";
import { fetchParties, Party } from "@/features/parties/api/parties";

const { Text } = Typography;

const ORDER_TYPES = ["Standard", "Rush", "Scheduled", "Rework", "Sample"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateWorkOrderModal({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ document_date: dayjs() });
    setSelectedBom(null);

    bomApi.list({ status: "published" }).then(res => {
      setBoms(res.boms);
    }).catch(() => {});

    fetchParties("customer", undefined, 0, 200).then(res => {
      setBuyers(res.parties);
    }).catch(() => {});
  }, [open, form]);

  const handleBomSelect = (bomId: number) => {
    const bom = boms.find(b => b.id === bomId) ?? null;
    setSelectedBom(bom);
    if (bom) form.setFieldValue("item_id", bom.fg_item_id);
  };

  const handleSave = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSaving(true);
    try {
      await workOrderApi.create({
        item_id: values.item_id as number,
        quantity: values.quantity as number,
        buyer_id: values.buyer_id as number | undefined,
        order_type: values.order_type as string | undefined,
        document_date: values.document_date
          ? (values.document_date as dayjs.Dayjs).toISOString()
          : undefined,
        delivery_date: values.delivery_date
          ? (values.delivery_date as dayjs.Dayjs).toISOString()
          : undefined,
      });
      message.success("Work order created successfully");
      onSuccess();
      onClose();
    } catch {
      message.error("Failed to create work order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={640}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Create Work Order</span>
        </div>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={handleSave}
            style={{ background: "#389e7f", borderColor: "#389e7f" }}
          >
            Create Work Order
          </Button>
        </div>
      }
    >
      {/* Info strip */}
      <div style={{ background: "#f0faf6", padding: "10px 16px", borderRadius: 6, marginBottom: 24 }}>
        <Text style={{ color: "#389e7f", fontSize: 13 }}>
          A work order instructs your team to produce a quantity of a finished good by a target delivery date.
        </Text>
      </div>

      <Form form={form} layout="vertical" requiredMark>

        {/* Hidden field — populated from BOM selection */}
        <Form.Item name="item_id" hidden><InputNumber /></Form.Item>

        <Form.Item
          label="Bill of Materials (BOM)"
          name="bom_id"
          rules={[{ required: true, message: "Please select a BOM" }]}
        >
          <Select
            showSearch
            placeholder="Search and select a published BOM"
            optionFilterProp="label"
            onChange={handleBomSelect}
            options={boms.map(b => ({
              value: b.id,
              label: `${b.bom_id} — ${b.bom_name}`,
            }))}
          />
        </Form.Item>

        {/* BOM preview */}
        {selectedBom && (
          <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Finished Good</Text>
                <div><Text strong>{selectedBom.fg_name || `Item #${selectedBom.fg_item_id}`}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>UoM</Text>
                <div><Text strong>{selectedBom.fg_uom || "—"}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Raw Materials</Text>
                <div><Text strong>{selectedBom.num_rm} components</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
                <div><Tag color="success">Published</Tag></div>
              </div>
            </div>
          </div>
        )}

        <Form.Item
          label="Quantity"
          name="quantity"
          rules={[
            { required: true, message: "Please enter quantity" },
            { type: "number", min: 1, message: "Quantity must be at least 1" },
          ]}
        >
          <InputNumber
            min={1}
            style={{ width: "100%" }}
            placeholder="e.g. 50"
            addonAfter={selectedBom?.fg_uom || "units"}
          />
        </Form.Item>

        <Form.Item label="Buyer" name="buyer_id">
          <Select
            showSearch
            allowClear
            placeholder="Select buyer (optional)"
            optionFilterProp="label"
            options={buyers.map(p => ({
              value: p.id,
              label: p.name,
            }))}
          />
        </Form.Item>

        <Form.Item label="Order Type" name="order_type">
          <Select
            allowClear
            placeholder="Select order type (optional)"
            options={ORDER_TYPES.map(t => ({ value: t, label: t }))}
          />
        </Form.Item>

        <div style={{ display: "flex", gap: 16 }}>
          <Form.Item label="Document Date" name="document_date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            label="Delivery Date"
            name="delivery_date"
            style={{ flex: 1 }}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue("document_date")) return Promise.resolve();
                  if (value.isBefore(getFieldValue("document_date"))) {
                    return Promise.reject("Delivery date must be after document date");
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

      </Form>
    </Modal>
  );
}
