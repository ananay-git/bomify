import { useEffect, useState, useCallback } from "react";
import {
  Modal, Input, Select, InputNumber, Button, Typography, message,
  Collapse, Tooltip, Table, Popconfirm,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, InfoCircleOutlined,
  PaperClipOutlined, FileTextOutlined, MessageOutlined,
  SaveOutlined, MenuOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { bomApi } from "@/features/production/api";
import { inventoryApi, InventoryItem } from "@/features/inventory/api";

const { Text } = Typography;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FGRow {
  key: string;
  item_id: number | null;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
  cost_allocation: number | null;
  comment: string;
}

interface RMRow {
  key: string;
  item_id: number | null;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
  comment: string;
}

interface ScrapRow {
  key: string;
  item_id: number | null;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
  cost_allocation: number | null;
  comment: string;
}

interface OtherCharge {
  key: string;
  classification: string;
  amount: number;
  comment: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STORE_OPTIONS = ["Default Stock Store", "Main Warehouse", "FG Warehouse", "RM Warehouse"];

const DEFAULT_OTHER_CHARGES: OtherCharge[] = [
  { key: "1", classification: "Labour Charges", amount: 0, comment: "" },
  { key: "2", classification: "Machinery Charges", amount: 0, comment: "" },
  { key: "3", classification: "Electricity Charges", amount: 0, comment: "" },
  { key: "4", classification: "Other Charges", amount: 0, comment: "" },
];

const UOM_OPTIONS = ["Kg", "g", "Liter", "ml", "Meter", "cm", "Piece", "Box", "Dozen", "Ton", "Bag", "Roll"];

const newFGRow = (): FGRow => ({ key: crypto.randomUUID(), item_id: null, name: "", category: "", quantity: null, unit: "", cost_allocation: null, comment: "" });
const newRMRow = (): RMRow => ({ key: crypto.randomUUID(), item_id: null, name: "", category: "", quantity: null, unit: "", comment: "" });
const newScrapRow = (): ScrapRow => ({ key: crypto.randomUUID(), item_id: null, name: "", category: "", quantity: null, unit: "", cost_allocation: null, comment: "" });

/* ================================================================== */
/*  CreateBomModal                                                     */
/* ================================================================== */

export default function CreateBomModal({ open, onClose, onSuccess }: Props) {
  // Document header
  const [nextBomId, setNextBomId] = useState("");
  const [bomName, setBomName] = useState("");
  const [fgStore, setFgStore] = useState("Default Stock Store");
  const [rmStore, setRmStore] = useState("Default Stock Store");
  const [scrapStore, setScrapStore] = useState("Default Stock Store");

  // Items data
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);

  // Section rows
  const [fgRows, setFgRows] = useState<FGRow[]>([newFGRow()]);
  const [rmRows, setRmRows] = useState<RMRow[]>([newRMRow()]);
  const [scrapRows, setScrapRows] = useState<ScrapRow[]>([]);
  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>(DEFAULT_OTHER_CHARGES.map(c => ({ ...c })));

  // Visibility of optional sections
  const [showRM, setShowRM] = useState(true);
  const [showFG, setShowFG] = useState(true);
  const [showScrap, setShowScrap] = useState(false);

  const [saving, setSaving] = useState(false);

  // Derived item lists
  const fgItems = allItems.filter(i => i.category === "finished_good");
  const rmItems = allItems.filter(i => i.category === "raw_material" || i.category === "packaging");

  /* ─ Load data on open ─ */
  useEffect(() => {
    if (!open) return;
    bomApi.getNextId().then(setNextBomId).catch(() => setNextBomId("BOM00001"));
    inventoryApi.getAll().then(res => setAllItems(res.items)).catch(() => {});
    // Reset form
    setBomName("");
    setFgStore("Default Stock Store");
    setRmStore("Default Stock Store");
    setScrapStore("Default Stock Store");
    setFgRows([newFGRow()]);
    setRmRows([newRMRow()]);
    setScrapRows([]);
    setOtherCharges(DEFAULT_OTHER_CHARGES.map(c => ({ ...c })));
    setShowRM(true);
    setShowFG(true);
    setShowScrap(false);
  }, [open]);

  /* ─ Helpers to update rows ─ */
  const updateFG = useCallback((key: string, field: keyof FGRow, value: unknown) => {
    setFgRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  }, []);
  const updateRM = useCallback((key: string, field: keyof RMRow, value: unknown) => {
    setRmRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  }, []);
  const updateScrap = useCallback((key: string, field: keyof ScrapRow, value: unknown) => {
    setScrapRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  }, []);
  const updateCharge = useCallback((key: string, field: keyof OtherCharge, value: unknown) => {
    setOtherCharges(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  }, []);

  type RowSetter = (key: string, field: never, value: unknown) => void;

  /* ─ When an item is selected, auto-fill name / category / unit ─ */
  const onItemSelected = (
    itemId: number,
    key: string,
    setter: RowSetter,
  ) => {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
      setter(key, "item_id" as never, item.id);
      setter(key, "name" as never, item.name);
      setter(key, "category" as never, item.category ?? "");
      setter(key, "unit" as never, item.unit_of_measure ?? "");
    }
  };

  const onNameSelected = (
    name: string,
    key: string,
    items: InventoryItem[],
    setter: RowSetter,
  ) => {
    const item = items.find(i => i.name === name);
    if (item) {
      setter(key, "item_id" as never, item.id);
      setter(key, "name" as never, item.name);
      setter(key, "category" as never, item.category ?? "");
      setter(key, "unit" as never, item.unit_of_measure ?? "");
    }
  };

  /* ─ Save handler ─ */
  const handleSave = async (asDraft: boolean) => {
    // Validate: need a BOM name and at least one FG item
    if (!bomName.trim()) {
      message.warning("Please enter a Document Name");
      return;
    }
    const validFG = fgRows.filter(r => r.item_id);
    if (validFG.length === 0) {
      message.warning("Please add at least one Finished Good item");
      return;
    }

    const validRM = rmRows.filter(r => r.item_id && r.quantity && r.quantity > 0);

    setSaving(true);
    try {
      await bomApi.create({
        bom_name: bomName.trim(),
        fg_item_id: validFG[0].item_id!,
        status: asDraft ? "draft" : "published",
        items: validRM.map(r => ({ item_id: r.item_id!, quantity: r.quantity! })),
      });
      message.success(asDraft ? "BOM saved as draft" : "BOM created successfully");
      onSuccess();
      onClose();
    } catch {
      message.error("Failed to create BOM");
    } finally {
      setSaving(false);
    }
  };

  /* ─ Item ID select renderer ─ */
  const itemIdSelect = (
    value: number | null,
    key: string,
    items: InventoryItem[],
    setter: RowSetter,
  ) => (
    <Select
      showSearch
      value={value ?? undefined}
      placeholder="Select"
      style={{ width: "100%" }}
      variant="borderless"
      optionFilterProp="label"
      onChange={(id: number) => onItemSelected(id, key, setter)}
      options={items.map(i => ({ value: i.id, label: i.sku }))}
    />
  );

  const itemNameSelect = (
    value: string,
    key: string,
    items: InventoryItem[],
    setter: RowSetter,
  ) => (
    <Select
      showSearch
      value={value || undefined}
      placeholder="Select"
      style={{ width: "100%" }}
      variant="borderless"
      optionFilterProp="label"
      onChange={(name: string) => onNameSelected(name, key, items, setter)}
      options={items.map(i => ({ value: i.name, label: i.name }))}
    />
  );

  /* ================================================================ */
  /*  Column definitions                                                */
  /* ================================================================ */

  const fgColumns = [
    { title: "#", key: "idx", width: 50, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: "ID", dataIndex: "item_id", key: "id", width: 180, render: (_: unknown, r: FGRow) => itemIdSelect(r.item_id, r.key, fgItems, updateFG as RowSetter) },
    { title: "Name", dataIndex: "name", key: "name", width: 180, render: (_: unknown, r: FGRow) => itemNameSelect(r.name, r.key, fgItems, updateFG as RowSetter) },
    { title: "Item Category", dataIndex: "category", key: "category", width: 140, render: (v: string) => v ? v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "" },
    { title: "Quantity", key: "quantity", width: 120, render: (_: unknown, r: FGRow) => <InputNumber value={r.quantity} placeholder="Amount" variant="borderless" style={{ width: "100%" }} onChange={v => updateFG(r.key, "quantity", v)} /> },
    { title: "Unit", key: "unit", width: 120, render: (_: unknown, r: FGRow) => (
      <Select value={r.unit || undefined} placeholder="Enter" variant="borderless" style={{ width: "100%" }} onChange={v => updateFG(r.key, "unit", v)} options={UOM_OPTIONS.map(u => ({ value: u, label: u }))} />
    )},
    { title: "Cost Allocation (%)", key: "cost", width: 150, render: (_: unknown, r: FGRow) => <InputNumber value={r.cost_allocation} variant="borderless" style={{ width: "100%" }} onChange={v => updateFG(r.key, "cost_allocation", v)} /> },
    { title: "Comment", key: "comment", width: 160, render: (_: unknown, r: FGRow) => <Input value={r.comment} variant="borderless" onChange={e => updateFG(r.key, "comment", e.target.value)} /> },
    {
      title: "Alternate Items", key: "alt", width: 120, render: () => (
        <Button type="text" icon={<PlusOutlined />} style={{ color: "#8c8c8c" }} />
      ),
    },
  ];

  const rmColumns = [
    { title: "#", key: "idx", width: 50, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: "ID", dataIndex: "item_id", key: "id", width: 180, render: (_: unknown, r: RMRow) => itemIdSelect(r.item_id, r.key, rmItems, updateRM as RowSetter) },
    { title: "Name", dataIndex: "name", key: "name", width: 180, render: (_: unknown, r: RMRow) => itemNameSelect(r.name, r.key, rmItems, updateRM as RowSetter) },
    { title: "Category", dataIndex: "category", key: "category", width: 140, render: (v: string) => v ? v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "" },
    { title: "Quantity", key: "quantity", width: 120, render: (_: unknown, r: RMRow) => <InputNumber value={r.quantity} variant="borderless" style={{ width: "100%" }} onChange={v => updateRM(r.key, "quantity", v)} /> },
    { title: "Unit", key: "unit", width: 120, render: (_: unknown, r: RMRow) => (
      <Select value={r.unit || undefined} variant="borderless" style={{ width: "100%" }} onChange={v => updateRM(r.key, "unit", v)} options={UOM_OPTIONS.map(u => ({ value: u, label: u }))} />
    )},
    { title: "Comment", key: "comment", width: 160, render: (_: unknown, r: RMRow) => <Input value={r.comment} variant="borderless" onChange={e => updateRM(r.key, "comment", e.target.value)} /> },
    {
      title: "Alternate Items", key: "alt", width: 120, render: () => (
        <Button type="text" icon={<PlusOutlined />} style={{ color: "#8c8c8c" }} />
      ),
    },
    {
      title: "", key: "drag", width: 40, render: () => <MenuOutlined style={{ color: "#bfbfbf", cursor: "grab" }} />,
    },
    {
      title: "", key: "actions", width: 50, render: (_: unknown, r: RMRow) => (
        <Popconfirm title="Remove this row?" onConfirm={() => setRmRows(prev => prev.filter(x => x.key !== r.key))}>
          <Button type="text" icon={<MoreOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const scrapColumns = [
    { title: "#", key: "idx", width: 50, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: "ID", dataIndex: "item_id", key: "id", width: 180, render: (_: unknown, r: ScrapRow) => itemIdSelect(r.item_id, r.key, allItems, updateScrap as RowSetter) },
    { title: "Name", dataIndex: "name", key: "name", width: 180, render: (_: unknown, r: ScrapRow) => itemNameSelect(r.name, r.key, allItems, updateScrap as RowSetter) },
    { title: "Category", dataIndex: "category", key: "category", width: 140, render: (v: string) => v ? v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "" },
    { title: "Quantity", key: "quantity", width: 120, render: (_: unknown, r: ScrapRow) => <InputNumber value={r.quantity} variant="borderless" style={{ width: "100%" }} onChange={v => updateScrap(r.key, "quantity", v)} /> },
    { title: "Unit", key: "unit", width: 120, render: (_: unknown, r: ScrapRow) => (
      <Select value={r.unit || undefined} variant="borderless" style={{ width: "100%" }} onChange={v => updateScrap(r.key, "unit", v)} options={UOM_OPTIONS.map(u => ({ value: u, label: u }))} />
    )},
    { title: "Cost Allocation (%)", key: "cost", width: 150, render: (_: unknown, r: ScrapRow) => <InputNumber value={r.cost_allocation} variant="borderless" style={{ width: "100%" }} onChange={v => updateScrap(r.key, "cost_allocation", v)} /> },
    { title: "Comment", key: "comment", width: 160, render: (_: unknown, r: ScrapRow) => <Input value={r.comment} variant="borderless" onChange={e => updateScrap(r.key, "comment", e.target.value)} /> },
    {
      title: "Actions", key: "actions", width: 80, render: (_: unknown, r: ScrapRow) => (
        <Popconfirm title="Remove?" onConfirm={() => setScrapRows(prev => prev.filter(x => x.key !== r.key))}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const chargeColumns = [
    { title: "#", key: "idx", width: 60, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: "Classification", dataIndex: "classification", key: "classification", width: 300 },
    { title: "Amount", key: "amount", width: 200, render: (_: unknown, r: OtherCharge) => <InputNumber value={r.amount} style={{ width: "100%" }} onChange={v => updateCharge(r.key, "amount", v ?? 0)} /> },
    { title: "Comment", key: "comment", render: (_: unknown, r: OtherCharge) => <Input value={r.comment} onChange={e => updateCharge(r.key, "comment", e.target.value)} /> },
  ];

  /* ================================================================ */
  /*  Section header style                                              */
  /* ================================================================ */

  const sectionHeader = (title: string, tooltip: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Text strong style={{ fontSize: 15 }}>{title}</Text>
      <Tooltip title={tooltip}><InfoCircleOutlined style={{ color: "#bfbfbf" }} /></Tooltip>
    </div>
  );

  const tableHeaderStyle: React.CSSProperties = {
    background: "#e6f7f2",
  };

  /* ================================================================ */
  /*  Render                                                            */
  /* ================================================================ */

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={1200}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Create Bill of Material</span>
        </div>
      }
      footer={null}
      styles={{ body: { padding: 0, maxHeight: "80vh", overflowY: "auto" } }}
    >
      {/* ── Info Banner ── */}
      <div style={{ background: "#f0faf6", padding: "12px 24px", borderBottom: "1px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#389e7f", fontSize: 13 }}>
          Create new bill of material by adding raw material and routing required to get the finished product.
        </Text>
        <Text style={{ color: "#8c8c8c", fontSize: 13 }}>
          Last Modified Date : {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} - {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        {/* ── Document Detail ── */}
        <Collapse
          defaultActiveKey={["doc"]}
          ghost
          style={{ marginTop: 16 }}
          items={[{
            key: "doc",
            label: sectionHeader("Document Detail", "Enter basic BOM details such as document ID, name, and store assignments"),
            children: (
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <Text style={{ display: "block", fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>Document Number</Text>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Select value={nextBomId} style={{ width: 180 }} disabled>
                        <Select.Option value={nextBomId}>{nextBomId}</Select.Option>
                      </Select>
                      <Text style={{ color: "#389e7f", cursor: "pointer", fontSize: 13 }}>Customize</Text>
                    </div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Text style={{ display: "block", fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>Document Name</Text>
                    <Input value={bomName} onChange={e => setBomName(e.target.value)} placeholder="Enter BOM name" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <Text style={{ display: "block", fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>FG Store</Text>
                    <Select value={fgStore} onChange={setFgStore} style={{ width: "100%" }} options={STORE_OPTIONS.map(s => ({ value: s, label: s }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text style={{ display: "block", fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>RM Store</Text>
                    <Select value={rmStore} onChange={setRmStore} style={{ width: "100%" }} options={STORE_OPTIONS.map(s => ({ value: s, label: s }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text style={{ display: "block", fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>Scrap/By-product Store</Text>
                    <Select value={scrapStore} onChange={setScrapStore} style={{ width: "100%" }} options={STORE_OPTIONS.map(s => ({ value: s, label: s }))} />
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, display: "flex", gap: 24 }}>
                  <Button type="link" icon={<PaperClipOutlined />} style={{ padding: 0, color: "#389e7f", fontWeight: 500 }}>Attachments</Button>
                  <Button type="link" icon={<FileTextOutlined />} style={{ padding: 0, color: "#595959" }}>Add Description</Button>
                  <Button type="link" icon={<MessageOutlined />} style={{ padding: 0, color: "#595959" }}>Add Comments</Button>
                </div>
              </div>
            ),
          }]}
        />

        {/* ── Quick Action Links ── */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, margin: "20px 0", padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
          <Button type="link" style={{ color: "#1890ff", fontWeight: 500 }} icon={<PlusOutlined style={{ color: "#1890ff" }} />}
            onClick={() => { setShowRM(true); setRmRows(prev => [...prev, newRMRow()]); }}>
            Add Raw Materials
          </Button>
          <Button type="link" style={{ color: "#faad14", fontWeight: 500 }} icon={<PlusOutlined style={{ color: "#faad14" }} />}>
            Add Routing
          </Button>
          <Button type="link" style={{ color: "#1890ff", fontWeight: 500 }} icon={<PlusOutlined style={{ color: "#1890ff" }} />}
            onClick={() => { setShowScrap(true); setScrapRows(prev => [...prev, newScrapRow()]); }}>
            Add Scraps/By-products
          </Button>
          <Button type="link" style={{ color: "#52c41a", fontWeight: 500 }} icon={<PlusOutlined style={{ color: "#52c41a" }} />}
            onClick={() => { setShowFG(true); setFgRows(prev => [...prev, newFGRow()]); }}>
            Add Finished Goods
          </Button>
        </div>

        {/* ── Finished Goods ── */}
        {showFG && (
          <Collapse
            defaultActiveKey={["fg"]}
            ghost
            style={{ marginBottom: 16 }}
            items={[{
              key: "fg",
              label: sectionHeader("Finished Goods", "The finished product(s) produced by this BOM"),
              children: (
                <Table
                  columns={fgColumns}
                  dataSource={fgRows}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  scroll={{ x: 1100 }}
                  style={{ border: "1px solid #e8e8e8", borderRadius: 8 }}
                  onHeaderRow={() => ({ style: tableHeaderStyle })}
                />
              ),
            }]}
          />
        )}

        {/* ── Raw Materials ── */}
        {showRM && (
          <Collapse
            defaultActiveKey={["rm"]}
            ghost
            style={{ marginBottom: 16 }}
            items={[{
              key: "rm",
              label: sectionHeader("Raw Materials", "Raw materials required to produce the finished good"),
              children: (
                <>
                  <Table
                    columns={rmColumns}
                    dataSource={rmRows}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    scroll={{ x: 1100 }}
                    style={{ border: "1px solid #e8e8e8", borderRadius: 8 }}
                    onHeaderRow={() => ({ style: tableHeaderStyle })}
                  />
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => setRmRows(prev => [...prev, newRMRow()])}
                    style={{ marginTop: 12, color: "#389e7f", borderColor: "#389e7f" }}
                  >
                    Add Raw Material Row
                  </Button>
                </>
              ),
            }]}
          />
        )}

        {/* ── Scrap / By-products ── */}
        {showScrap && (
          <Collapse
            defaultActiveKey={["scrap"]}
            ghost
            style={{ marginBottom: 16 }}
            items={[{
              key: "scrap",
              label: sectionHeader("Scrap/By-products", "Scrap or by-products generated during production"),
              children: (
                <>
                  <Table
                    columns={scrapColumns}
                    dataSource={scrapRows}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    scroll={{ x: 1100 }}
                    locale={{ emptyText: "No data available" }}
                    style={{ border: "1px solid #e8e8e8", borderRadius: 8 }}
                    onHeaderRow={() => ({ style: tableHeaderStyle })}
                  />
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => setScrapRows(prev => [...prev, newScrapRow()])}
                    style={{ marginTop: 12, color: "#389e7f", borderColor: "#389e7f" }}
                  >
                    Add Scrap/By-product Row
                  </Button>
                </>
              ),
            }]}
          />
        )}

        {/* ── Other Charges ── */}
        <Collapse
          defaultActiveKey={["charges"]}
          ghost
          style={{ marginBottom: 24 }}
          items={[{
            key: "charges",
            label: sectionHeader("Other Charges", "Additional charges like labour, machinery, electricity etc."),
            children: (
              <Table
                columns={chargeColumns}
                dataSource={otherCharges}
                rowKey="key"
                pagination={false}
                size="small"
                style={{ border: "1px solid #e8e8e8", borderRadius: 8 }}
                onHeaderRow={() => ({ style: tableHeaderStyle })}
              />
            ),
          }]}
        />

        {/* ── Footer Buttons ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
          <Button
            icon={<SaveOutlined />}
            onClick={() => handleSave(true)}
            loading={saving}
            style={{ borderColor: "#389e7f", color: "#389e7f" }}
          >
            Save to Draft
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => handleSave(false)}
            loading={saving}
            style={{ background: "#389e7f", borderColor: "#389e7f" }}
          >
            Save BOM
          </Button>
        </div>
      </div>
    </Modal>
  );
}
