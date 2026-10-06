/**
 * @component AssignToStaffModal
 *
 * The owner sends a work order to staff. Every staff member is notified (browser
 * pop-up + email) and the order appears on the shared staff dashboard.
 */

import { useState } from "react";
import { Form, Input, Modal, Typography } from "antd";
import { message } from "@/lib/antdHelper";
import { extractApiError } from "@/lib/errors";
import { formatQty } from "@/lib/time";
import { taskApi } from "@/features/tasks/api";
import type { WorkOrder } from "@/features/production/api";

const { Text } = Typography;

interface Props {
  workOrder: WorkOrder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignToStaffModal({ workOrder, onClose, onSuccess }: Props) {
  const [form] = Form.useForm<{ note?: string }>();
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!workOrder) return;
    const values = await form.validateFields();

    setSaving(true);
    try {
      const res = await taskApi.assign({
        work_order_id: workOrder.id,
        note: values.note?.trim() || undefined,
      });
      if (res.notified_staff === 0) {
        message.warning(
          "Assigned, but there are no active staff accounts yet. Add staff under Users & Team so they can see it.",
        );
      } else {
        message.success(
          `Sent to ${res.notified_staff} staff ${res.notified_staff === 1 ? "member" : "members"}`,
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      message.error(extractApiError(err, "Could not assign this order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Assign to staff"
      open={!!workOrder}
      onCancel={onClose}
      onOk={() => void handleSend()}
      okText="Send to staff"
      confirmLoading={saving}
      destroyOnHidden
    >
      {workOrder && (
        <Form form={form} layout="vertical" preserve={false}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>
              {workOrder.item_name ?? "Work order"} · {formatQty(workOrder.quantity)} {workOrder.uom}
            </Text>
            <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
              Every staff member gets a browser notification and an email, and sees this order on their
              dashboard.
              {workOrder.process_stage === "open" && " Production starts for this order automatically."}
            </Text>
          </div>
          <Form.Item name="note" label="Note for staff (optional)">
            <Input.TextArea rows={3} maxLength={1000} placeholder="For example: use the dark varnish" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
