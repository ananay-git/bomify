import { useEffect, useState, useCallback } from "react";
import { Table, Button, Tag, Modal, Form, Input, Typography, Space, Drawer, Switch, Dropdown, Checkbox, Radio } from 'antd';
import { message } from '@/lib/antdHelper';
import { PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, MoreOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { fetchUsers, createUser, updateUser, resetUserPassword, deleteUser } from "@/features/users";
import type { User, CreateUserPayload, UpdateUserPayload } from "@/features/users";
import { getUser } from "@/app/store";
import { extractApiError } from "@/lib/errors";
import type { MenuProps } from "antd";

const { Title, Text } = Typography;

const MODULE_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "sales", label: "Sales Orders" },
  { value: "purchases", label: "Purchases" },
  { value: "production", label: "Production" },
  { value: "inventory", label: "Inventory" },
  { value: "dispatch", label: "Dispatch" },
  { value: "parties", label: "Parties" },
  { value: "copilot", label: "AI Copilot" },
  { value: "users", label: "Users & Team (Admin)" },
  { value: "settings", label: "Settings (Admin)" },
];

export default function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchRowOpen, setSearchRowOpen] = useState(false);

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const createRole = Form.useWatch("role", createForm) as "owner" | "staff" | undefined;
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm] = Form.useForm();
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetForm] = Form.useForm();

  const currentUser = getUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      message.error(extractApiError(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (values: CreateUserPayload) => {
    try {
      await createUser(values);
      message.success("User created");
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (err) {
      message.error(extractApiError(err, "Failed to create user"));
    }
  };

  useEffect(() => {
    if (editUser) {
      editForm.setFieldsValue({
        full_name: editUser.full_name,
        email: editUser.email,
        module_permissions: editUser.module_permissions,
        is_active: editUser.is_active,
      });
    } else {
      editForm.resetFields();
    }
  }, [editUser, editForm]);

  const handleEdit = async (values: UpdateUserPayload) => {
    if (!editUser) return;
    try {
      await updateUser(editUser.id, values);
      message.success("User updated");
      setEditUser(null);
      load();
    } catch (err) {
      message.error(extractApiError(err, "Failed to update user"));
    }
  };

  const handleResetPassword = async ({ new_password }: { new_password: string; }) => {
    if (!resetTarget) return;
    try {
      await resetUserPassword(resetTarget.id, new_password);
      message.success(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
      resetForm.resetFields();
    } catch (err) {
      message.error(extractApiError(err, "Failed to reset password"));
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId);
      message.success("User deleted");
      load();
    } catch (err) {
      message.error(extractApiError(err, "Failed to delete user"));
    }
  };

  const getRowActions = (record: User): MenuProps["items"] => {
    const isSelf = currentUser?.id === record.id;
    return [
      { key: "edit", icon: <EditOutlined />, label: "Edit User", onClick: () => setEditUser(record) },
      { key: "reset-pw", icon: <LockOutlined />, label: "Reset Password", onClick: () => setResetTarget(record) },
      { type: "divider" as const },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        label: "Delete User",
        danger: true,
        disabled: isSelf,
        onClick: () => {
          Modal.confirm({
            title: `Delete "${record.username}"?`,
            content: "This action cannot be undone.",
            okText: "Delete",
            okButtonProps: { danger: true },
            onOk: () => handleDelete(record.id),
          });
        },
      },
    ];
  };

  const renderColumnTitle = (title: string, showSearch: boolean = true) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#595959', fontSize: '13px', fontWeight: 600 }}>{title}</span>
              <Space orientation="vertical" size={-8} style={{ marginLeft: 6 }}>
                  <ArrowUpOutlined style={{ fontSize: 9, color: '#bfbfbf', fontWeight: 'bold', cursor: 'pointer' }} />
                  <ArrowDownOutlined style={{ fontSize: 9, color: '#bfbfbf', fontWeight: 'bold', cursor: 'pointer' }} />
              </Space>
          </div>
          {showSearch && searchRowOpen && (
              <Input
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }}/>}
                  placeholder="Search"
                  size="small"
                  style={{ borderRadius: '6px', fontSize: '12px', fontWeight: 'normal' }}
                  onClick={(e) => e.stopPropagation()}
              />
          )}
      </div>
  );

  const columns = [
    {
        title: renderColumnTitle("Username"),
        dataIndex: "username",
        key: "username",
        render: (text: string) => <Text style={{ color: '#1890ff', fontWeight: 500 }}>{text}</Text>
    },
    { title: renderColumnTitle("Full Name"), dataIndex: "full_name", key: "full_name" },
    { title: renderColumnTitle("Email"), dataIndex: "email", key: "email" },
    {
      title: renderColumnTitle("Account", false),
      dataIndex: "role",
      key: "role",
      render: (role: User["role"]) =>
        role === "staff" ? <Tag color="green">Staff</Tag> : <Tag color="blue">Owner</Tag>,
    },
    {
      title: renderColumnTitle("Modules", false),
      dataIndex: "module_permissions",
      key: "module_permissions",
      render: (modules: string[], record: User) => record.role === "staff" ? (
        <Tag style={{ borderRadius: '12px', fontSize: '11px', padding: '1px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d' }}>
          Task dashboard only
        </Tag>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {modules.map(m => {
            const label = MODULE_OPTIONS.find(o => o.value === m)?.label ?? m;
            return (
              <Tag key={m} style={{ borderRadius: '12px', fontSize: '11px', padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
                {label}
              </Tag>
            );
          })}
        </div>
      ),
    },
    {
      title: renderColumnTitle("Status"),
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) =>
        active ? (
          <Tag style={{ borderRadius: '16px', background: '#fff', border: '1px solid #52c41a', color: '#52c41a', padding: '2px 10px' }}>Active</Tag>
        ) : (
          <Tag style={{ borderRadius: '16px', background: '#fff', border: '1px solid #d9d9d9', color: '#595959', padding: '2px 10px' }}>Inactive</Tag>
        ),
    },
    {
      title: "",
      key: "action",
      width: 48,
      render: (_: unknown, record: User) => (
        <Dropdown menu={{ items: getRowActions(record) }} trigger={["click"]}>
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }}>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>Users & Permissions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add User
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: '20px' }}>
              <Space size="large" align="center">
                  <Button type="link" icon={<SearchOutlined />} onClick={() => setSearchRowOpen(!searchRowOpen)} style={{ fontWeight: 500, padding: 0 }}>
                      Search
                  </Button>
              </Space>
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 -24px 0 -24px' }} />

          <Table
            dataSource={users}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
                total,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                defaultPageSize: 20,
                showTotal: (total, range) => `${range[0]} to ${range[1]} of ${total}`,
                style: { padding: '16px 24px', margin: 0, borderTop: '1px solid #f0f0f0' }
            }}
            size="middle"
            className="custom-grid-table"
          />
      </div>

      <Modal title="Create New User" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText="Create" destroyOnHidden>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} preserve={false}>
          <Form.Item name="role" label="Account type" initialValue="owner">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: "Owner", value: "owner" },
                { label: "Staff", value: "staff" },
              ]}
            />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
            extra={createRole === "staff" ? "Order notifications are emailed here." : undefined}
          >
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          {createRole === "staff" ? (
            <Text type="secondary" style={{ display: 'block' }}>
              Staff only see the shared task dashboard. They get a browser notification and an email when you
              assign an order, and they tell you when it is ready for dispatch.
            </Text>
          ) : (
            <Form.Item name="module_permissions" label="Module Access">
              <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODULE_OPTIONS.map(opt => (
                  <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Drawer title={`Edit: ${editUser?.username ?? ""}`} open={!!editUser} onClose={() => setEditUser(null)} styles={{ wrapper: { width: 400 } }} extra={<Button type="primary" onClick={() => editForm.submit()}>Save</Button>} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} preserve={false}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
          {editUser?.role === "staff" ? (
            <Text type="secondary" style={{ display: 'block' }}>
              Staff account: only sees the shared task dashboard.
            </Text>
          ) : (
            <Form.Item name="module_permissions" label="Module Access">
              <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODULE_OPTIONS.map(opt => (
                  <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      <Modal title={`Reset Password: ${resetTarget?.username ?? ""}`} open={!!resetTarget} onCancel={() => { setResetTarget(null); resetForm.resetFields(); }} onOk={() => resetForm.submit()} okText="Reset Password" destroyOnHidden>
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword} preserve={false}>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true, min: 6, message: "Min 6 characters" }]}><Input.Password placeholder="Enter new password" /></Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm Password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "Please confirm the password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) { return Promise.resolve(); }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
          .custom-grid-table .ant-table-thead > tr > th { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; }
          .custom-grid-table .ant-table-tbody > tr > td { padding: 16px; }
          .custom-grid-table .ant-table-pagination.ant-pagination { background: #fafafa; border-top: 1px solid #f0f0f0; border-radius: 0 0 8px 8px; margin: 0 !important; padding: 16px 24px !important; }
      `}</style>
    </div>
  );
}
