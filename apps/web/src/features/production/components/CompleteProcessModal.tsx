import { useState, useEffect } from "react";
import {
  Modal, Form, InputNumber, Table, Typography, Divider, Alert, Space, Tag, Spin, Result, Button
} from "antd";
import {
  CheckCircleOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ExclamationCircleOutlined, CheckOutlined, TruckOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { processApi, bomApi, ProductionProcess } from "@/features/production/api";
import { inventoryApi, InventoryItem } from "@/features/inventory/api";

const { Text } = Typography;

interface MaterialRow {
  key: number;
  name: string;
  sku: string;
  required: number;
  available: number;
  uom: string;
  sufficient: boolean;
}

interface Props {
  process: ProductionProcess | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompleteProcessModal({ process, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [completedProcess, setCompletedProcess] = useState<ProductionProcess | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!process) {
      setMaterialRows([]);
      setApiError(null);
      setCompletedProcess(null);
      return;
    }
    setCompletedProcess(null);
    form.setFieldsValue({ completed_quantity: process.target_quantity });
    setApiError(null);

    const hasMaterialsIssued = process.issued_items.length > 0;

    if (hasMaterialsIssued) {
      // Materials already issued — just show them (stock already deducted)
      setMaterialRows(process.issued_items.map(ii => ({
        key: ii.id,
        name: ii.item_name || `Item #${ii.item_id}`,
        sku: ii.item_sku || "-",
        required: ii.issued_quantity,
        available: ii.issued_quantity,
        uom: "",
        sufficient: true,
      })));
    } else if (process.bom_id) {
      // Not yet issued — fetch BOM + live stock levels
      setStockLoading(true);
      bomApi.get(process.bom_id)
        .then(async (b) => {
          const rows: MaterialRow[] = await Promise.all(
            b.items.map(async (bi) => {
              const required = bi.quantity * process.target_quantity;
              let item: InventoryItem | null = null;
              try { item = await inventoryApi.getById(bi.item_id); } catch { /* ignore */ }
              return {
                key: bi.id,
                name: bi.item_name || item?.name || `Item #${bi.item_id}`,
                sku: bi.item_sku || item?.sku || "-",
                required,
                available: item?.current_stock ?? 0,
                uom: bi.unit_of_measure || item?.unit_of_measure || "",
                sufficient: (item?.current_stock ?? 0) >= required,
              };
            })
          );
          setMaterialRows(rows);
        })
        .catch(() => setMaterialRows([]))
        .finally(() => setStockLoading(false));
    } else {
      setMaterialRows([]);
    }
  }, [process, form]);

  if (!process) return null;

  const hasMaterialsIssued = process.issued_items.length > 0;
  const isOpen = process.stage === "open";
  const noBom = isOpen && !process.bom_id;
  const bomHasNoItems = isOpen && !!process.bom_id && !stockLoading && materialRows.length === 0;
  const hasShortage = !hasMaterialsIssued && materialRows.some(r => !r.sufficient);
  const canComplete = !hasShortage && !stockLoading && !bomHasNoItems;

  const handleConfirm = async () => {
    setApiError(null);
    try {
      const values = await form.validateFields();
      setLoading(true);
      const result = await processApi.complete(process.id, values.completed_quantity);
      setCompletedProcess(result);
      onSuccess();
      // Wait for user to decide what to do next
    } catch (err: unknown) {
      // Show backend error message if it's an API error
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      if (axiosErr?.response?.data?.detail) {
        setApiError(axiosErr.response.data.detail);
      }
      // antd shows validation errors automatically
    } finally {
      setLoading(false);
    }
  };

  const completedQty: number = form.getFieldValue("completed_quantity") ?? process.target_quantity;

  const materialColumns = [
    {
      title: "Item",
      dataIndex: "name",
      key: "name",
      render: (v: string, r: MaterialRow) => (
        <Space>
          {r.sufficient
            ? <CheckOutlined style={{ color: "#52c41a" }} />
            : <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />}
          <Text style={{ color: r.sufficient ? "inherit" : "#ff4d4f" }}>{v}</Text>
        </Space>
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku", render: (v: string) => <Text type="secondary">{v}</Text> },
    {
      title: "Required",
      dataIndex: "required",
      key: "required",
      render: (v: number, r: MaterialRow) => (
        <Text style={{ color: r.sufficient ? "inherit" : "#ff4d4f", fontWeight: 600 }}>
          {v} {r.uom}
        </Text>
      ),
    },
    {
      title: "In Stock",
      dataIndex: "available",
      key: "available",
      render: (v: number, r: MaterialRow) => (
        <Text style={{ color: r.sufficient ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}>
          {v} {r.uom}
        </Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, r: MaterialRow) =>
        hasMaterialsIssued ? (
          <Tag color="success">Issued</Tag>
        ) : r.sufficient ? (
          <Tag color="success">OK</Tag>
        ) : (
          <Tag color="error">Insufficient</Tag>
        ),
    },
  ];

  if (completedProcess) {
    return (
      <Modal open={true} footer={null} closable={false} width={500} onCancel={onClose}>
        <Result
          status="success"
          title="Production Complete!"
          subTitle={`Successfully added ${completedProcess.completed_quantity} ${completedProcess.fg_uom || 'units'} of ${completedProcess.fg_name || `Item #${completedProcess.fg_item_id}`} to inventory.`}
          extra={[
            <Button 
              key="dispatch" 
              type="primary" 
              icon={<TruckOutlined />} 
              onClick={() => {
                onClose();
                if (completedProcess.linked_sales_order_id) {
                    navigate(`/app/dispatch/create?so_id=${completedProcess.linked_sales_order_id}`);
                } else {
                    navigate(`/app/dispatch/create?process_id=${completedProcess.id}`);
                }
              }}
              style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
            >
              Start Dispatch
            </Button>,
            <Button key="close" onClick={onClose} style={{ marginLeft: 8 }}>
              Done
            </Button>
          ]}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open={!!process}
      onCancel={onClose}
      onOk={handleConfirm}
      okText="Mark as Complete"
      okButtonProps={{
        icon: <CheckCircleOutlined />,
        style: { background: canComplete ? "#52c41a" : undefined, borderColor: canComplete ? "#52c41a" : undefined },
        loading,
        disabled: !canComplete,
      }}
      title={
        <Space>
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
          <span>Complete Production Process — {process.process_number}</span>
        </Space>
      }
      width={680}
      destroyOnClose
    >
      {/* Process summary */}
      <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
        <Space size="large" wrap>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Finished Good</Text>
            <div><Text strong>{process.fg_name || `Item #${process.fg_item_id}`}</Text></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Target Qty</Text>
            <div><Text strong>{process.target_quantity} {process.fg_uom || ""}</Text></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>BOM</Text>
            <div><Text strong>{process.bom_number || "—"}</Text></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Stage</Text>
            <div>
              <Tag color="orange" style={{ borderRadius: 12 }}>
                {process.stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </Tag>
            </div>
          </div>
        </Space>
      </div>

      {/* BOM has no components */}
      {bomHasNoItems && (
        <Alert
          type="error"
          showIcon
          message={`BOM ${process.bom_number} has no raw material components`}
          description="Add components to this BOM in the Bill of Materials tab before completing production."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Shortage alert */}
      {hasShortage && (
        <Alert
          type="error"
          showIcon
          message="Insufficient stock — cannot complete this production process"
          description="One or more raw materials do not have enough stock. Please restock before completing."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* API error */}
      {apiError && (
        <Alert
          type="error"
          showIcon
          message="Production failed"
          description={apiError}
          closable
          onClose={() => setApiError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {noBom && (
        <Alert type="warning" showIcon
          message="No BOM linked — raw materials will NOT be automatically deducted from inventory."
          style={{ marginBottom: 16 }}
        />
      )}

      {!hasMaterialsIssued && process.bom_id && !hasShortage && !stockLoading && (
        <Alert type="info" showIcon
          message="All raw materials are in stock. They will be automatically deducted on completion."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Completed quantity */}
      <Form form={form} layout="vertical">
        <Form.Item
          name="completed_quantity"
          label="Completed Quantity"
          rules={[
            { required: true, message: "Enter completed quantity" },
            { type: "number", min: 0.01, message: "Must be greater than 0" },
          ]}
        >
          <InputNumber
            min={0.01}
            style={{ width: "100%" }}
            addonAfter={process.fg_uom || "units"}
            placeholder={`Default: ${process.target_quantity}`}
          />
        </Form.Item>
      </Form>

      {/* Inventory impact */}
      <Divider style={{ margin: "12px 0" }} />
      <Text strong style={{ fontSize: 13 }}>Inventory Impact</Text>

      {/* FG addition */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 12, padding: "8px 12px", background: "#f6ffed", borderRadius: 6, border: "1px solid #d9f7be" }}>
        <ArrowUpOutlined style={{ color: "#52c41a", fontSize: 16 }} />
        <Text strong style={{ color: "#52c41a" }}>+{completedQty} {process.fg_uom || "units"}</Text>
        <Text style={{ color: "#595959" }}>
          {process.fg_name || `Item #${process.fg_item_id}`} (Finished Good added to inventory)
        </Text>
      </div>

      {/* Raw materials table */}
      {stockLoading ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>Checking stock levels…</Text>
        </div>
      ) : materialRows.length > 0 && (
        <>
          <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowDownOutlined style={{ color: "#ff4d4f" }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hasMaterialsIssued
                ? "Raw materials already deducted when items were issued:"
                : "Raw materials that will be deducted from inventory:"}
            </Text>
          </div>
          <Table
            size="small"
            dataSource={materialRows}
            pagination={false}
            rowKey="key"
            columns={materialColumns}
            rowClassName={(r: MaterialRow) => (!r.sufficient && !hasMaterialsIssued) ? "bg-red-50" : ""}
          />
        </>
      )}
    </Modal>
  );
}
