import { useEffect, useState } from "react";
import {
  Modal, Table, Tag, Typography, Spin, Descriptions, Button, Space,
  Input, InputNumber, Select, message,
} from "antd";
import {
  FileTextOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  CloseOutlined, PlusOutlined,
} from "@ant-design/icons";
import { bomApi, BOM, BOMItem } from "@/features/production/api";
import { inventoryApi, InventoryItem } from "@/features/inventory/api";

const { Text } = Typography;

interface Props {
  bom: BOM | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  draft:     { color: "#d48806", bg: "#fffbe6", border: "#ffe58f" },
  published: { color: "#52c41a", bg: "#f6ffed", border: "#b7eb8f" },
  archived:  { color: "#595959", bg: "#fafafa", border: "#d9d9d9" },
};

const STATUS_OPTIONS = [
  { value: "draft",     label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived",  label: "Archived" },
];

const UOM_OPTIONS = ["Kg","g","Liter","ml","Meter","cm","Piece","Box","Dozen","Ton","Bag","Roll"];

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface EditRMRow {
  key: string;
  item_id: number | null;
  item_name: string;
  item_sku: string;
  unit_of_measure: string;
  quantity: number | null;
}

function bomItemToEditRow(b: BOMItem): EditRMRow {
  return {
    key: String(b.id),
    item_id: b.item_id,
    item_name: b.item_name ?? "",
    item_sku: b.item_sku ?? "",
    unit_of_measure: b.unit_of_measure ?? "",
    quantity: Number(b.quantity),
  };
}

export default function ViewBomModal({ bom, onClose, onSaved }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "published" | "archived">("draft");
  const [editRows, setEditRows] = useState<EditRMRow[]>([]);
  const [rmItems, setRmItems] = useState<InventoryItem[]>([]);
  const [loadingRm, setLoadingRm] = useState(false);

  useEffect(() => {
    if (!bom) { setEditMode(false); return; }
    setEditName(bom.bom_name);
    setEditStatus(bom.status);
    setEditRows(bom.items.map(bomItemToEditRow));
    setEditMode(false);
  }, [bom?.id]);

  const enterEdit = () => {
    if (!bom) return;
    setEditName(bom.bom_name);
    setEditStatus(bom.status);
    setEditRows(bom.items.map(bomItemToEditRow));
    setLoadingRm(true);
    inventoryApi.getAll()
      .then(res => setRmItems(res.items.filter(i => i.category === "raw_material" || i.category === "packaging")))
      .catch(() => {})
      .finally(() => setLoadingRm(false));
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (!bom) return;
    setEditName(bom.bom_name);
    setEditStatus(bom.status);
    setEditRows(bom.items.map(bomItemToEditRow));
    setEditMode(false);
  };

  const updateRow = (key: string, field: keyof EditRMRow, value: unknown) => {
    setEditRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const onRmSelected = (itemId: number, key: string) => {
    const item = rmItems.find(i => i.id === itemId);
    if (!item) return;
    setEditRows(prev => prev.map(r => r.key === key ? {
      ...r,
      item_id: item.id,
      item_name: item.name,
      item_sku: item.sku,
      unit_of_measure: item.unit_of_measure ?? "",
    } : r));
  };

  const addRow = () => {
    setEditRows(prev => [...prev, {
      key: crypto.randomUUID(),
      item_id: null, item_name: "", item_sku: "", unit_of_measure: "", quantity: null,
    }]);
  };

  const removeRow = (key: string) => setEditRows(prev => prev.filter(r => r.key !== key));

  const handleSave = async () => {
    if (!bom || !editName.trim()) { message.warning("BOM name is required"); return; }
    const validItems = editRows.filter(r => r.item_id && r.quantity && r.quantity > 0);
    setSaving(true);
    try {
      await bomApi.update(bom.id, {
        bom_name: editName.trim(),
        status: editStatus,
        items: validItems.map(r => ({ item_id: r.item_id!, quantity: r.quantity! })),
      });
      message.success("BOM updated successfully");
      setEditMode(false);
      onSaved();
    } catch {
      message.error("Failed to update BOM");
    } finally {
      setSaving(false);
    }
  };

  const statusCfg = bom ? (STATUS_CFG[bom.status] ?? STATUS_CFG.draft) : STATUS_CFG.draft;

  const editColumns = [
    { title: "#", key: "idx", width: 50, render: (_: unknown, __: unknown, i: number) => i + 1 },
    {
      title: "Item", key: "item", width: 220,
      render: (_: unknown, r: EditRMRow) => (
        <Select
          showSearch
          value={r.item_id ?? undefined}
          placeholder="Select item"
          style={{ width: "100%" }}
          variant="borderless"
          optionFilterProp="label"
          loading={loadingRm}
          onChange={(id: number) => onRmSelected(id, r.key)}
          options={rmItems.map(i => ({ value: i.id, label: `${i.sku} — ${i.name}` }))}
        />
      ),
    },
    {
      title: "Item Name", key: "name",
      render: (_: unknown, r: EditRMRow) => <Text style={{ color: "#595959" }}>{r.item_name || "-"}</Text>,
    },
    {
      title: "Unit", key: "unit", width: 120,
      render: (_: unknown, r: EditRMRow) => (
        <Select
          value={r.unit_of_measure || undefined}
          placeholder="Unit"
          variant="borderless"
          style={{ width: "100%" }}
          onChange={v => updateRow(r.key, "unit_of_measure", v)}
          options={UOM_OPTIONS.map(u => ({ value: u, label: u }))}
        />
      ),
    },
    {
      title: "Quantity", key: "quantity", width: 120,
      render: (_: unknown, r: EditRMRow) => (
        <InputNumber
          value={r.quantity}
          min={0.01}
          variant="borderless"
          style={{ width: "100%" }}
          onChange={v => updateRow(r.key, "quantity", v)}
        />
      ),
    },
    {
      title: "", key: "del", width: 50,
      render: (_: unknown, r: EditRMRow) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} />
      ),
    },
  ];

  return (
    <Modal
      open={!!bom}
      onCancel={onClose}
      destroyOnClose
      width={900}
      footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {bom ? `${bom.bom_id} — ${bom.bom_name}` : "Bill of Materials"}
          </span>
        </div>
      }
      styles={{ body: { padding: 0, maxHeight: "82vh", overflowY: "auto" } }}
    >
      {!bom && (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      )}

      {bom && (
        <>
          {/* ── Top strip ── */}
          <div style={{
            background: "#f0faf6", padding: "12px 24px",
            borderBottom: "1px solid #e8e8e8",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <Tag style={{
              borderRadius: 16, background: statusCfg.bg,
              border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
              padding: "2px 14px", fontWeight: 600, fontSize: 13,
            }}>
              {bom.status.charAt(0).toUpperCase() + bom.status.slice(1)}
            </Tag>

            <Space>
              <Text style={{ color: "#8c8c8c", fontSize: 13 }}>
                Last modified: {fmtDate(bom.updated_at)}
                {bom.last_modified_by ? ` by ${bom.last_modified_by}` : ""}
              </Text>
              {!editMode && (
                <Button icon={<EditOutlined />} onClick={enterEdit}>Edit</Button>
              )}
              {editMode && (
                <>
                  <Button icon={<CloseOutlined />} onClick={cancelEdit}>Cancel</Button>
                  <Button
                    type="primary" icon={<SaveOutlined />}
                    loading={saving} onClick={handleSave}
                    style={{ background: "#389e7f", borderColor: "#389e7f" }}
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </Space>
          </div>

          <div style={{ padding: "20px 24px 24px" }}>
            {/* ── BOM details ── */}
            <Descriptions
              bordered size="small" column={2}
              style={{ marginBottom: 28 }}
              styles={{ label: { background: "#fafafa", fontWeight: 600, width: 160 } }}
            >
              <Descriptions.Item label="BOM ID">{bom.bom_id}</Descriptions.Item>
              <Descriptions.Item label="BOM Name">
                {editMode
                  ? <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  : bom.bom_name}
              </Descriptions.Item>
              <Descriptions.Item label="Finished Good">
                {bom.fg_name ?? "-"} ({bom.fg_uom ?? "-"})
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {editMode
                  ? <Select value={editStatus} onChange={setEditStatus} style={{ width: "100%" }} options={STATUS_OPTIONS} />
                  : <Tag style={{
                      borderRadius: 12, background: statusCfg.bg,
                      border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
                      padding: "1px 10px", fontWeight: 600,
                    }}>
                      {bom.status.charAt(0).toUpperCase() + bom.status.slice(1)}
                    </Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Created">{fmtDate(bom.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Last Modified">{fmtDate(bom.updated_at)}</Descriptions.Item>
            </Descriptions>

            {/* ── Raw materials (edit mode only) ── */}
            {editMode && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 14 }}>
                    Raw Materials ({editRows.length})
                  </Text>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRow}
                    style={{ color: "#389e7f", borderColor: "#389e7f" }}>
                    Add Row
                  </Button>
                </div>
                <Table
                  columns={editColumns}
                  dataSource={editRows}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: "No raw materials — click Add Row to add one" }}
                  style={{ border: "1px solid #e8e8e8", borderRadius: 8 }}
                  onHeaderRow={() => ({ style: { background: "#e6f7f2" } })}
                />
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
