import { useEffect, useState } from "react";
import { Table, Button, Typography, Tag, Space, Input, Select, Tabs, Tooltip, Popconfirm, message } from "antd";
import {
  PlusOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CaretRightOutlined, DeleteOutlined, InfoCircleOutlined, SettingOutlined, CheckCircleOutlined, TruckOutlined,
  SendOutlined, UndoOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  processApi, workOrderApi, bomApi,
  ProductionProcess, WorkOrder, BOM,
} from "@/features/production/api";
import CreateBomModal from "@/features/production/components/CreateBomModal";
import CreateWorkOrderModal from "@/features/production/components/CreateWorkOrderModal";
import ViewBomModal from "@/features/production/components/ViewBomModal";
import CompleteProcessModal from "@/features/production/components/CompleteProcessModal";
import AssignToStaffModal from "@/features/tasks/components/AssignToStaffModal";
import { taskApi } from "@/features/tasks/api";
import type { StaffTask } from "@/features/tasks/api";
import { extractApiError } from "@/lib/errors";

const { Title, Text } = Typography;

// ─── Shared Column Header ───────────────────────────────────────────────────

function ColTitle({ title, searchOpen }: { title: string; searchOpen: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ color: "#595959", fontSize: 13, fontWeight: 600 }}>{title}</span>
        <Space size={-8} style={{ marginLeft: 6, flexDirection: "column" }}>
          <ArrowUpOutlined style={{ fontSize: 9, color: "#bfbfbf", cursor: "pointer" }} />
          <ArrowDownOutlined style={{ fontSize: 9, color: "#bfbfbf", cursor: "pointer" }} />
        </Space>
      </div>
      {searchOpen && (
        <Input
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          placeholder="Search"
          size="small"
          style={{ borderRadius: 6, fontSize: 12, fontWeight: "normal" }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function stageTag(val: string) {
  const map: Record<string, { color: string; border: string }> = {
    open:            { color: "#faad14", border: "#faad14" },
    material_issued: { color: "#1890ff", border: "#1890ff" },
    in_progress:     { color: "#1890ff", border: "#1890ff" },
    completed:       { color: "#52c41a", border: "#52c41a" },
    cancelled:       { color: "#ff4d4f", border: "#ff4d4f" },
    not_started:     { color: "#595959", border: "#d9d9d9" },
    running:         { color: "#1890ff", border: "#1890ff" },
    on_hold:         { color: "#faad14", border: "#faad14" },
  };
  const cfg = map[val] || map.open;
  return (
    <Tag style={{ borderRadius: 16, background: "#fff", border: `1px solid ${cfg.border}`, color: cfg.color, padding: "2px 10px" }}>
      {val?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Tag>
  );
}

const tableCSS = `
  .prod-table .ant-table-thead > tr > th { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; }
  .prod-table .ant-table-tbody > tr > td { padding: 16px; }
  .prod-table .ant-table-pagination.ant-pagination { background: #fafafa; border-top: 1px solid #f0f0f0; border-radius: 0 0 8px 8px; margin: 0 !important; padding: 16px 24px !important; }
`;

// ─── All Production Process Tab ─────────────────────────────────────────────

function AllProcessTab({ refreshTick }: { refreshTick: number }) {
  const [data, setData] = useState<ProductionProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [completeProcess, setCompleteProcess] = useState<ProductionProcess | null>(null);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (stageFilter !== "all") params.stage = stageFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.process_type = typeFilter;
      const res = await processApi.list(params);
      setData(res.processes);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [stageFilter, statusFilter, typeFilter, refreshTick]);

  const col = (title: string) => <ColTitle title={title} searchOpen={searchOpen} />;

  const columns = [
    { title: col("Reference Number"), dataIndex: "reference_number", key: "reference_number", render: (v: string) => v || "-" },
    { title: col("Process Number"), dataIndex: "process_number", key: "process_number", render: (v: string) => <Text style={{ color: "#1890ff", fontWeight: 500 }}>{v}</Text> },
    { title: col("Stage"), key: "stage", render: (_: unknown, r: ProductionProcess) => stageTag(r.stage) },
    { title: col("Status"), key: "status", render: (_: unknown, r: ProductionProcess) => stageTag(r.status) },
    { title: col("BOM Number"), dataIndex: "bom_number", key: "bom_number", render: (v: string) => v || "-" },
    { title: col("FG Item ID"), dataIndex: "fg_item_id", key: "fg_item_id" },
    { title: col("FG Name"), dataIndex: "fg_name", key: "fg_name", render: (v: string) => v || "-" },
    { title: col("Type of Process"), dataIndex: "process_type", key: "process_type", render: (v: string) => v?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
    { title: col("FG UoM"), dataIndex: "fg_uom", key: "fg_uom", render: (v: string) => v || "-" },
    { title: col("Target Quantity"), dataIndex: "target_quantity", key: "target_quantity" },
    { title: col("Completed Quantity"), dataIndex: "completed_quantity", key: "completed_quantity" },
    { title: col("Created At"), key: "created_at", render: (_: unknown, r: ProductionProcess) => fmtDate(r.created_at) },
    { title: col("Order Delivery Date"), key: "order_delivery_date", render: (_: unknown, r: ProductionProcess) => fmtDate(r.order_delivery_date) },
    { title: col("Expected Completion Date"), key: "expected_completion_date", render: (_: unknown, r: ProductionProcess) => fmtDate(r.expected_completion_date) },
    { title: col("Last Modified By"), dataIndex: "last_modified_by", key: "last_modified_by", render: (v: string) => v || "-" },
    { title: col("Last Modified At"), key: "updated_at", render: (_: unknown, r: ProductionProcess) => fmtDate(r.updated_at) },
    {
      title: "Actions", key: "actions", fixed: "right" as const, width: 120,
      render: (_: unknown, r: ProductionProcess) =>
        r.stage !== "completed" && r.stage !== "cancelled" ? (
          <Tooltip title="Mark as Complete">
            <Button
              type="text"
              icon={<CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />}
              onClick={() => setCompleteProcess(r)}
            />
          </Tooltip>
        ) : r.stage === "completed" && r.linked_dispatch_status === "delivered" ? (
          <Tag
            icon={<CheckCircleOutlined />}
            color="success"
            style={{ borderRadius: 12, fontWeight: 600, fontSize: 12, padding: "2px 10px" }}
          >
            Delivered
          </Tag>
        ) : r.stage === "completed" && r.linked_dispatch_status ? (
          <Tag color="processing" style={{ borderRadius: 12, fontWeight: 600, fontSize: 12, padding: "2px 10px" }}>
            {r.linked_dispatch_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Tag>
        ) : r.stage === "completed" && !r.linked_dispatch_status ? (
          <Tooltip title="Start Dispatch">
            <Button
              type="text"
              icon={<TruckOutlined style={{ color: "#1890ff", fontSize: 18 }} />}
              onClick={() => navigate(r.linked_sales_order_id ? `/app/dispatch/create?so_id=${r.linked_sales_order_id}` : `/app/dispatch/create?process_id=${r.id}`)}
            />
          </Tooltip>
        ) : null,
    },
  ];

  const handleIssueItems = async (id: number) => {
    try {
      await processApi.issueFromBom(id);
      message.success("Items issued from BOM successfully");
      fetch();
    } catch {
      message.error("Failed to issue items");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>All Production Process</Title>
          <Tooltip title="Track all production process execution"><InfoCircleOutlined style={{ color: "#bfbfbf" }} /></Tooltip>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          const ids = data.filter(p => p.stage === "open" || p.stage === "material_issued").map(p => p.id);
          if (ids.length === 0) { message.info("No open processes to issue items for"); return; }
          handleIssueItems(ids[0]);
        }}>Issue Items</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200" style={{ padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ marginBottom: 20 }}>
          <Space size="large" align="center">
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Stage</Text>
              <Select value={stageFilter} onChange={setStageFilter} style={{ width: 160 }} options={[
                { value: "all", label: "All" },
                { value: "open", label: "Open" },
                { value: "material_issued", label: "Material Issued" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
            </div>
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Status</Text>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }} options={[
                { value: "all", label: "All" },
                { value: "not_started", label: "Not Started" },
                { value: "running", label: "Running" },
                { value: "on_hold", label: "On Hold" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
            </div>
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Type</Text>
              <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 220 }} options={[
                { value: "all", label: "All Processes (Master + Child)" },
                { value: "master", label: "Master" },
                { value: "child", label: "Child" },
              ]} />
            </div>
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Show/Hide Columns</Text>
              <Select defaultValue="14" style={{ width: 180 }} options={[{ value: "14", label: "14 columns selected" }]} />
            </div>
          </Space>
        </div>
        <div style={{ borderTop: "1px solid #f0f0f0", margin: "0 -24px" }} />
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1900 }}
          pagination={{ showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], defaultPageSize: 10, showTotal: (t, r) => `${r[0]} to ${r[1]} of ${t}` }}
          size="middle"
          className="prod-table"
        />
      </div>

      <CompleteProcessModal
        process={completeProcess}
        onClose={() => setCompleteProcess(null)}
        onSuccess={() => { message.success("Production process completed"); fetch(); }}
      />
    </>
  );
}

// ─── Work Orders Tab ────────────────────────────────────────────────────────

function WorkOrdersTab({ refreshTick, onProcessCreated }: { refreshTick: number; onProcessCreated: () => void }) {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  // Orders already sent to staff, keyed by work order id
  const [staffTasks, setStaffTasks] = useState<Record<number, StaffTask>>({});
  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (stageFilter !== "all") params.stage = stageFilter;
      const res = await workOrderApi.list(params);
      setData(res.orders);
    } catch { /* empty */ } finally { setLoading(false); }

    try {
      const res = await taskApi.list();
      const byWorkOrder: Record<number, StaffTask> = {};
      for (const task of res.tasks) {
        if (task.work_order_id != null && !byWorkOrder[task.work_order_id]) {
          byWorkOrder[task.work_order_id] = task; // list is newest first
        }
      }
      setStaffTasks(byWorkOrder);
    } catch { /* the staff column is optional — the rest of the page still works */ }
  };

  useEffect(() => { fetch(); }, [stageFilter, refreshTick, localRefresh]);

  const col = (title: string) => <ColTitle title={title} searchOpen={false} />;

  const startProcess = async (id: number) => {
    try {
      await workOrderApi.startProcess(id);
      message.success("Production process started");
      setLocalRefresh(t => t + 1);
      onProcessCreated();
    } catch {
      message.error("Failed to start process");
    }
  };

  const deleteWO = async (id: number) => {
    try {
      await workOrderApi.delete(id);
      message.success("Work order deleted");
      fetch();
    } catch {
      message.error("Failed to delete work order");
    }
  };

  const withdrawFromStaff = async (taskId: number) => {
    try {
      await taskApi.cancel(taskId);
      message.success("Order withdrawn from staff");
      fetch();
    } catch (err) {
      message.error(extractApiError(err, "Could not withdraw this order"));
    }
  };

  const staffTag = (task?: StaffTask) => {
    if (task?.status === "assigned") return <Tag color="blue">With staff</Tag>;
    if (task?.status === "ready_for_dispatch") return <Tag color="green">Ready for dispatch</Tag>;
    return "-";
  };

  const columns = [
    { title: col("Item ID"), dataIndex: "item_sku", key: "item_sku", render: (v: string) => v || "-" },
    { title: col("Item Name"), dataIndex: "item_name", key: "item_name", render: (v: string) => <Text style={{ fontWeight: 500 }}>{v || "-"}</Text> },
    { title: col("UOM"), dataIndex: "uom", key: "uom", render: (v: string) => v || "-" },
    { title: col("Quantity"), dataIndex: "quantity", key: "quantity" },
    { title: col("Buyer"), dataIndex: "buyer_name", key: "buyer_name", render: (v: string) => v || "-" },
    { title: col("Document Number"), dataIndex: "document_number", key: "document_number", render: (v: string) => v || "-" },
    { title: col("Order Type"), dataIndex: "order_type", key: "order_type", render: (v: string) => v || "-" },
    { title: col("Process Number"), dataIndex: "process_number", key: "process_number", render: (v: string) => v || "-" },
    { title: col("Process Stage"), key: "process_stage", render: (_: unknown, r: WorkOrder) => stageTag(r.process_stage) },
    { title: col("WO Creation Date"), key: "created_at", render: (_: unknown, r: WorkOrder) => fmtDate(r.created_at) },
    { title: col("Document Date"), key: "document_date", render: (_: unknown, r: WorkOrder) => fmtDate(r.document_date) },
    { title: col("Delivery Date"), key: "delivery_date", render: (_: unknown, r: WorkOrder) => fmtDate(r.delivery_date) },
    { title: col("Created By"), dataIndex: "created_by", key: "created_by", render: (v: string) => v || "-" },
    { title: col("Staff"), key: "staff", render: (_: unknown, r: WorkOrder) => staffTag(staffTasks[r.id]) },
    {
      title: "Actions", key: "actions", fixed: "right" as const, width: 150,
      render: (_: unknown, r: WorkOrder) => {
        const task = staffTasks[r.id];
        const withStaff = task?.status === "assigned";
        const sentToStaff = withStaff || task?.status === "ready_for_dispatch";
        const canAssign = (r.process_stage === "open" || r.process_stage === "in_progress") && !sentToStaff;
        return (
        <Space>
          {r.process_stage === "open" && (
            <Tooltip title="Start Production Process">
              <Button type="text" icon={<CaretRightOutlined style={{ color: "#52c41a" }} />} onClick={() => startProcess(r.id)} />
            </Tooltip>
          )}
          {canAssign && (
            <Tooltip title="Assign to staff">
              <Button type="text" icon={<SendOutlined style={{ color: "#1677ff" }} />} onClick={() => setAssignTarget(r)} />
            </Tooltip>
          )}
          {withStaff && task && (
            <Popconfirm title="Withdraw this order from staff?" onConfirm={() => withdrawFromStaff(task.id)}>
              <Tooltip title="Withdraw from staff">
                <Button type="text" icon={<UndoOutlined style={{ color: "#fa8c16" }} />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm title="Delete this work order?" onConfirm={() => deleteWO(r.id)}>
            <Button type="text" icon={<DeleteOutlined style={{ color: "#ff4d4f" }} />} />
          </Popconfirm>
        </Space>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Work Orders</Title>
          <Tooltip title="Manage work orders — demand from customers"><InfoCircleOutlined style={{ color: "#bfbfbf" }} /></Tooltip>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
          style={{ background: "#389e7f", borderColor: "#389e7f" }}>
          Create Work Order
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200" style={{ padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ marginBottom: 20 }}>
          <Space size="large" align="center">
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Stage</Text>
              <Select value={stageFilter} onChange={setStageFilter} style={{ width: 160 }} options={[
                { value: "all", label: "All" },
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
            </div>
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Show/Hide Columns</Text>
              <Select defaultValue="11" style={{ width: 180 }} options={[{ value: "11", label: "11 columns selected" }]} />
            </div>
          </Space>
        </div>
        <div style={{ borderTop: "1px solid #f0f0f0", margin: "0 -24px" }} />
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{ showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], defaultPageSize: 10, showTotal: (t, r) => `${r[0]} to ${r[1]} of ${t}` }}
          size="middle"
          className="prod-table"
        />
      </div>

      <CreateWorkOrderModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => setLocalRefresh(t => t + 1)} />
      <AssignToStaffModal
        workOrder={assignTarget}
        onClose={() => setAssignTarget(null)}
        onSuccess={() => { setLocalRefresh(t => t + 1); onProcessCreated(); }}
      />
    </>
  );
}


// ─── Bill of Materials Tab ──────────────────────────────────────────────────

function BOMTab({ refreshTick }: { refreshTick: number }) {
  const [data, setData] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewBom, setViewBom] = useState<BOM | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  const loadBoms = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await bomApi.list(params);
      setData(res.boms);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { loadBoms(); }, [statusFilter, refreshTick, localRefresh]);

  const col = (title: string) => <ColTitle title={title} searchOpen={false} />;

  const deleteBOM = async (id: number) => {
    try {
      await bomApi.delete(id);
      message.success("BOM deleted");
      setLocalRefresh(t => t + 1);
    } catch {
      message.error("Failed to delete BOM");
    }
  };

  const columns = [
    { title: "", key: "checkbox", width: 40, render: () => <input type="checkbox" /> },
    { title: col("BOM ID"), dataIndex: "bom_id", key: "bom_id", render: (v: string) => <Text style={{ color: "#1890ff", fontWeight: 500 }}>{v}</Text> },
    { title: col("BOM Name"), dataIndex: "bom_name", key: "bom_name", render: (v: string) => <Text style={{ fontWeight: 500 }}>{v}</Text> },
    {
      title: col("Status"), key: "status",
      render: (_: unknown, r: BOM) => {
        const cfg: Record<string, { color: string; bg: string; border: string }> = {
          draft:     { color: "#d48806", bg: "#fffbe6", border: "#ffe58f" },
          published: { color: "#52c41a", bg: "#f6ffed", border: "#b7eb8f" },
          archived:  { color: "#595959", bg: "#fafafa", border: "#d9d9d9" },
        };
        const c = cfg[r.status] || cfg.draft;
        return (
          <Tag style={{ borderRadius: 16, background: c.bg, border: `1px solid ${c.border}`, color: c.color, padding: "2px 12px", fontWeight: 600, fontSize: 12 }}>
            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
          </Tag>
        );
      },
    },
    { title: col("FG Item ID"), dataIndex: "fg_item_id", key: "fg_item_id" },
    { title: col("FG Name"), dataIndex: "fg_name", key: "fg_name", render: (v: string) => v || "-" },
    { title: col("Number of RM"), dataIndex: "num_rm", key: "num_rm" },
    { title: col("Last Modified By"), dataIndex: "last_modified_by", key: "last_modified_by", render: (v: string) => v || "-" },
    { title: col("Last Modified At"), key: "updated_at", render: (_: unknown, r: BOM) => fmtDate(r.updated_at) },
    {
      title: "Actions", key: "actions", fixed: "right" as const, width: 100,
      render: (_: unknown, r: BOM) => (
        <Space>
          <Tooltip title="View BOM">
            <Button type="text" icon={<CaretRightOutlined style={{ color: "#52c41a" }} />} onClick={() => setViewBom(r)} />
          </Tooltip>
          <Popconfirm title="Delete this BOM?" onConfirm={() => deleteBOM(r.id)}>
            <Button type="text" icon={<DeleteOutlined style={{ color: "#ff4d4f" }} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Bill of Materials</Title>
          <Tooltip title="Define recipes — what raw materials make a finished good"><InfoCircleOutlined style={{ color: "#bfbfbf" }} /></Tooltip>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create BOM</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200" style={{ padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ marginBottom: 20 }}>
          <Space size="large" align="center">
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Status</Text>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }} options={[
                { value: "all", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
                { value: "archived", label: "Archived" },
              ]} />
            </div>
            <div>
              <Text style={{ display: "block", fontSize: 13, color: "#595959", marginBottom: 8 }}>Show/Hide Columns</Text>
              <Select defaultValue="5" style={{ width: 180 }} options={[{ value: "5", label: "5 columns selected" }]} />
            </div>
          </Space>
        </div>
        <div style={{ borderTop: "1px solid #f0f0f0", margin: "0 -24px" }} />
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], defaultPageSize: 10, showTotal: (t, r) => `${r[0]} to ${r[1]} of ${t}` }}
          size="middle"
          className="prod-table"
        />
      </div>

      <CreateBomModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => setLocalRefresh(t => t + 1)} />
      <ViewBomModal bom={viewBom} onClose={() => setViewBom(null)} onSaved={() => { setViewBom(null); setLocalRefresh(t => t + 1); }} />
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProductionListPage() {
  const [processTick, setProcessTick] = useState(0);
  const [woTick, setWoTick] = useState(0);
  const [bomTick, setBomTick] = useState(0);

  const handleTabChange = (key: string) => {
    if (key === "processes") setProcessTick(t => t + 1);
    if (key === "work-orders") setWoTick(t => t + 1);
    if (key === "bom") setBomTick(t => t + 1);
  };

  const tabItems = [
    { key: "processes", label: "All Production Process", children: <AllProcessTab refreshTick={processTick} /> },
    { key: "work-orders", label: "Work Orders", children: <WorkOrdersTab refreshTick={woTick} onProcessCreated={() => setProcessTick(t => t + 1)} /> },
    { key: "bom", label: "Bill of Materials", children: <BOMTab refreshTick={bomTick} /> },
  ];

  return (
    <div style={{ padding: "0 0 32px 0", maxWidth: "100%", overflowX: "hidden" }}>
      <div style={{ background: "#001529", padding: "10px 24px", borderRadius: "8px 8px 0 0", marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <SettingOutlined style={{ color: "#fff", fontSize: 16 }} />
        <Text style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Production</Text>
      </div>
      <Tabs
        defaultActiveKey="processes"
        onChange={handleTabChange}
        items={tabItems}
        style={{ background: "#fff", padding: "0 24px", borderRadius: "0 0 8px 8px" }}
        tabBarStyle={{ marginBottom: 24 }}
      />
      <style>{tableCSS}</style>
    </div>
  );
}
