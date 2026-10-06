/**
 * Staff dashboard — one shared list of orders to complete.
 *
 * Every staff member sees the same tasks. When someone finishes an order and
 * ticks it off, it moves to "Recently finished" for everyone and the owner is
 * told it's ready for dispatch.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Spin, Tag, Typography } from "antd";
import { CheckCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { message } from "@/lib/antdHelper";
import { extractApiError } from "@/lib/errors";
import { formatDate, formatQty, isOverdue, timeAgo } from "@/lib/time";
import { staffTaskApi } from "@/features/tasks/api";
import type { StaffDashboard, StaffTask } from "@/features/tasks/api";
import { NOTIFICATIONS_EVENT } from "@/features/notifications/useNotifications";
import { useBrowserAlerts } from "@/features/notifications/useBrowserAlerts";

const { Title, Text } = Typography;

const REFRESH_MS = 15_000;

// ─── One order waiting to be done ───────────────────────────────────────────

function TodoCard({ task, onFinish }: { task: StaffTask; onFinish: (t: StaffTask) => void }) {
    const overdue = isOverdue(task.delivery_date);

    return (
        <div
            className="bg-white rounded-lg border border-gray-200"
            style={{ padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                        {task.item_name ?? task.process_number}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        {task.process_number}
                        {task.order_number ? ` · Order ${task.order_number}` : ""}
                    </Text>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: "#0f172a" }}>
                        {formatQty(task.target_quantity)}
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#64748b", marginLeft: 6 }}>
                            {task.uom}
                        </span>
                    </div>
                    {task.delivery_date && (
                        <Text style={{ fontSize: 13, color: overdue ? "#cf1322" : "#64748b" }}>
                            {overdue ? "Overdue · was due " : "Due "}
                            {formatDate(task.delivery_date)}
                        </Text>
                    )}
                </div>
            </div>

            {task.note && (
                <div
                    style={{
                        marginTop: 16,
                        padding: "10px 14px",
                        borderRadius: 6,
                        background: "#fffbe6",
                        border: "1px solid #ffe58f",
                    }}
                >
                    <Text strong style={{ display: "block", fontSize: 12, color: "#ad6800" }}>
                        Note from {task.assigned_by_name ?? "the owner"}
                    </Text>
                    <Text style={{ whiteSpace: "pre-wrap" }}>{task.note}</Text>
                </div>
            )}

            {task.materials.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <Text strong style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
                        Materials for this order
                    </Text>
                    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {task.materials.map((m, i) => (
                            <div
                                key={`${m.item_sku ?? m.item_name}-${i}`}
                                className="flex justify-between gap-3"
                                style={{ fontSize: 14, borderBottom: "1px dashed #f0f0f0", padding: "3px 0" }}
                            >
                                <span style={{ color: "#334155" }}>{m.item_name}</span>
                                <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>
                                    {formatQty(m.quantity)} {m.unit_of_measure}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 20 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Sent by {task.assigned_by_name ?? "the owner"} · {timeAgo(task.assigned_at)}
                </Text>
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={() => onFinish(task)}>
                    Done, ready for dispatch
                </Button>
            </div>
        </div>
    );
}

// ─── One finished order ─────────────────────────────────────────────────────

function DoneRow({ task }: { task: StaffTask }) {
    const made = task.completed_quantity ?? task.target_quantity;
    return (
        <div
            className="flex flex-wrap items-center justify-between gap-2"
            style={{ padding: "12px 0", borderBottom: "1px solid #f5f5f5" }}
        >
            <div>
                <Text strong>{task.item_name ?? task.process_number}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                    {formatQty(made)} {task.uom}
                    {made !== task.target_quantity ? ` of ${formatQty(task.target_quantity)}` : ""}
                </Text>
                <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                    {task.completed_by_name ? `Done by ${task.completed_by_name} · ` : "Done · "}
                    {timeAgo(task.completed_at ?? task.assigned_at)}
                </div>
            </div>
            <Tag color="gold" style={{ marginInlineEnd: 0 }}>Waiting for dispatch</Tag>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StaffDashboardPage() {
    const [data, setData] = useState<StaffDashboard>({ todo: [], done: [] });
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [finishing, setFinishing] = useState<StaffTask | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm<{ completed_quantity: number | null; note?: string }>();
    const { permission, enableBrowserAlerts } = useBrowserAlerts();

    const load = useCallback(async () => {
        try {
            setData(await staffTaskApi.dashboard());
            setLoadFailed(false);
        } catch {
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load now, then keep the list fresh: on a timer, when the tab is focused again,
    // and the moment a new notification arrives.
    useEffect(() => {
        void load();
        const timer = window.setInterval(() => void load(), REFRESH_MS);
        const onWake = () => void load();
        window.addEventListener("focus", onWake);
        window.addEventListener(NOTIFICATIONS_EVENT, onWake);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", onWake);
            window.removeEventListener(NOTIFICATIONS_EVENT, onWake);
        };
    }, [load]);

    const openFinish = (task: StaffTask) => {
        form.setFieldsValue({ completed_quantity: task.target_quantity, note: "" });
        setFinishing(task);
    };

    const submitFinish = async () => {
        if (!finishing) return;
        let values: { completed_quantity: number | null; note?: string };
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSaving(true);
        try {
            await staffTaskApi.complete(finishing.id, {
                completed_quantity: values.completed_quantity ?? undefined,
                note: values.note?.trim() || undefined,
            });
            message.success("Done. The owner has been told this order is ready for dispatch.");
            setFinishing(null);
            await load();
        } catch (err) {
            const detail = extractApiError(err, "Could not mark this order as done");
            message.error(
                detail.toLowerCase().includes("insufficient stock")
                    ? `${detail} Tell the owner so they can restock, then try again.`
                    : detail,
            );
            await load();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#262626" }}>
                        Orders to complete
                    </Title>
                    <Text type="secondary">
                        Everyone on staff sees this same list. When an order is finished, mark it done and the
                        owner is told it's ready for dispatch.
                    </Text>
                </div>
                <Button icon={<ReloadOutlined />} onClick={() => void load()}>
                    Refresh
                </Button>
            </div>

            {permission === "default" && (
                <div
                    className="flex flex-wrap items-center justify-between gap-3 mb-6"
                    style={{ padding: "12px 16px", borderRadius: 8, background: "#e6f4ff", border: "1px solid #91caff" }}
                >
                    <Text>Get a pop-up in this browser the moment the owner sends you a new order.</Text>
                    <Button type="primary" onClick={() => void enableBrowserAlerts()}>
                        Turn on browser alerts
                    </Button>
                </div>
            )}
            {permission === "denied" && (
                <div
                    className="mb-6"
                    style={{ padding: "12px 16px", borderRadius: 8, background: "#fff7e6", border: "1px solid #ffd591" }}
                >
                    <Text>
                        Browser alerts are blocked for this site, so you won't get pop-ups. Allow notifications in
                        your browser's site settings, or keep this page open and check the bell.
                    </Text>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center" style={{ padding: 64 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {loadFailed && (
                        <div
                            className="mb-4"
                            style={{ padding: "10px 14px", borderRadius: 8, background: "#fff1f0", border: "1px solid #ffa39e" }}
                        >
                            <Text>Couldn't refresh the list. Check your connection; this page will keep trying.</Text>
                        </div>
                    )}

                    {data.todo.length === 0 ? (
                        <div
                            className="bg-white rounded-lg border border-gray-200 text-center"
                            style={{ padding: "48px 24px" }}
                        >
                            <Title level={5} style={{ margin: 0 }}>No orders right now</Title>
                            <Text type="secondary">
                                When the owner sends an order, it appears here and you get a notification.
                            </Text>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Text strong style={{ fontSize: 15 }}>
                                To do ({data.todo.length})
                            </Text>
                            {data.todo.map((task) => (
                                <TodoCard key={task.id} task={task} onFinish={openFinish} />
                            ))}
                        </div>
                    )}

                    {data.done.length > 0 && (
                        <div style={{ marginTop: 40 }}>
                            <Text strong style={{ fontSize: 15 }}>Recently finished</Text>
                            <div
                                className="bg-white rounded-lg border border-gray-200"
                                style={{ padding: "4px 24px", marginTop: 12 }}
                            >
                                {data.done.map((task) => (
                                    <DoneRow key={task.id} task={task} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Modal
                title="Mark this order as done"
                open={!!finishing}
                onCancel={() => setFinishing(null)}
                onOk={() => void submitFinish()}
                okText="Mark as done"
                confirmLoading={saving}
                destroyOnHidden
            >
                {finishing && (
                    <Form form={form} layout="vertical" preserve={false}>
                        <Text style={{ display: "block", marginBottom: 16 }}>
                            {finishing.item_name} ({finishing.process_number}). The owner will be told it's ready
                            for dispatch.
                        </Text>
                        <Form.Item
                            name="completed_quantity"
                            label={`How many ${finishing.uom ?? "units"} did you finish?`}
                            rules={[{ required: true, message: "Enter how many you finished" }]}
                        >
                            <InputNumber min={0.01} style={{ width: "100%" }} size="large" />
                        </Form.Item>
                        <Form.Item name="note" label="Anything the owner should know? (optional)">
                            <Input.TextArea rows={3} maxLength={1000} placeholder="For example: 2 pieces cracked" />
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </div>
    );
}
