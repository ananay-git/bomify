import { useEffect, useState, useCallback } from "react";
import {
    Typography,
    Card,
    Form,
    Input,
    InputNumber,
    Switch,
    Select,
    Button,
    Divider,
    Spin,
    Tag,
    Badge,
    Tooltip,
} from "antd";
import { message } from "@/lib/antdHelper";
import {
    Building2,
    Package,
    Hash,
    Receipt,
    Users,
    Mail,
    GitBranch,
    Monitor,
    Save,
    RefreshCw,
    ChevronRight,
    ShieldCheck,
    Settings,
    FileText,
    ClipboardList,
    Truck,
    BarChart,
    ShoppingCart,
    Factory,
    Sparkles,
    Wrench,
    Coins,
    Inbox,
} from "lucide-react";
import { settingsApi, SettingsGrouped, SettingUpdatePayload } from "@/features/settings/api";

const { Title, Text } = Typography;

// ─── Section Definitions ─────────────────────────────────────────
interface SettingsSection {
    key: string;
    label: string;
    icon: React.ReactNode;
    description: string;
    color: string;
}

const SECTIONS: SettingsSection[] = [
    {
        key: "company",
        label: "Company Profile",
        icon: <Building2 size={20} />,
        description: "Organization identity & fiscal setup",
        color: "#3b82f6",
    },
    {
        key: "modules",
        label: "Module Configuration",
        icon: <Package size={20} />,
        description: "Enable or disable ERP modules",
        color: "#8b5cf6",
    },
    {
        key: "numbering",
        label: "Numbering Series",
        icon: <Hash size={20} />,
        description: "Document prefixes & auto-increment",
        color: "#06b6d4",
    },
    {
        key: "tax",
        label: "Tax & Currency",
        icon: <Receipt size={20} />,
        description: "Tax rates, GST/VAT, rounding",
        color: "#f59e0b",
    },
    {
        key: "users",
        label: "Users & Permissions",
        icon: <Users size={20} />,
        description: "Role management & access control",
        color: "#10b981",
    },
    {
        key: "notifications",
        label: "Email & Notifications",
        icon: <Mail size={20} />,
        description: "SMTP, alerts & notification rules",
        color: "#ef4444",
    },
    {
        key: "workflow",
        label: "Workflow & Approvals",
        icon: <GitBranch size={20} />,
        description: "Approval chains & auto-confirm",
        color: "#ec4899",
    },
    {
        key: "system",
        label: "System / General",
        icon: <Monitor size={20} />,
        description: "Date format, timezone, audit log",
        color: "#64748b",
    },
];

// ─── Main Component ──────────────────────────────────────────────

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState("company");
    const [settings, setSettings] = useState<SettingsGrouped>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form] = Form.useForm();

    // Load settings from API
    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            const data = await settingsApi.getAll();
            setSettings(data);
            // Flatten all settings into form fields as category__key
            const formValues: Record<string, any> = {};
            for (const [cat, entries] of Object.entries(data)) {
                for (const [key, val] of Object.entries(entries)) {
                    formValues[`${cat}__${key}`] = val;
                }
            }
            form.setFieldsValue(formValues);
            setDirty(false);
        } catch (err) {
            message.error("Failed to load settings");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [form]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Save all changed settings
    const handleSave = async () => {
        try {
            setSaving(true);
            const allValues = form.getFieldsValue();
            const updates: SettingUpdatePayload[] = [];

            for (const [fieldName, value] of Object.entries(allValues)) {
                const [category, key] = fieldName.split("__");
                if (!category || !key) continue;
                // Only send if value actually differs
                const original = settings[category]?.[key];
                if (JSON.stringify(original) !== JSON.stringify(value)) {
                    updates.push({ category, key, value });
                }
            }

            if (updates.length === 0) {
                message.info("No changes to save");
                return;
            }

            await settingsApi.bulkUpdate(updates);
            message.success(`Saved ${updates.length} setting${updates.length > 1 ? "s" : ""} successfully`);
            await loadSettings();
        } catch (err) {
            message.error("Failed to save settings");
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Render Functions ────────────────────────────────────────

    const renderCompanySection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Company Profile"
                subtitle="Your organization's identity and legal details. This information appears on invoices, purchase orders, and other documents."
                color="#3b82f6"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField name="company__company_name" label="Company Name" required>
                    <Input placeholder="e.g. QuadStack Pvt. Ltd." size="large" />
                </FormField>
                <FormField name="company__email" label="Primary Email">
                    <Input placeholder="info@company.com" size="large" />
                </FormField>
                <FormField name="company__phone" label="Phone">
                    <Input placeholder="+91 98765 43210" size="large" />
                </FormField>
                <FormField name="company__website" label="Website">
                    <Input placeholder="https://www.company.com" size="large" />
                </FormField>
                <FormField name="company__gstin" label="GSTIN">
                    <Input placeholder="22AAAAA0000A1Z5" size="large" style={{ fontFamily: "monospace" }} />
                </FormField>
                <FormField name="company__pan" label="PAN">
                    <Input placeholder="AAAAA0000A" size="large" style={{ fontFamily: "monospace" }} />
                </FormField>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <Title level={5} style={{ margin: 0, color: "#374151", fontWeight: 600 }}>
                Fiscal Settings
            </Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField name="company__fiscal_year_start" label="Fiscal Year Start (MM-DD)">
                    <Input placeholder="04-01" size="large" />
                </FormField>
                <FormField name="company__default_currency" label="Default Currency">
                    <Select
                        size="large"
                        options={[
                            { value: "INR", label: "₹ INR — Indian Rupee" },
                            { value: "USD", label: "$ USD — US Dollar" },
                            { value: "EUR", label: "€ EUR — Euro" },
                            { value: "GBP", label: "£ GBP — British Pound" },
                        ]}
                    />
                </FormField>
            </div>
        </div>
    );

    const renderModulesSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Module Configuration"
                subtitle="Enable or disable ERP modules based on your business requirements. Disabled modules are hidden from the sidebar."
                color="#8b5cf6"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                    { key: "sales_enabled", label: "Sales Module", desc: "Sales orders, quotations, order confirmations", color: "#3b82f6", icon: <BarChart size={28} color="#3b82f6" /> },
                    { key: "purchases_enabled", label: "Purchases Module", desc: "Purchase orders, inward, invoices, GRN", color: "#22c55e", icon: <ShoppingCart size={28} color="#22c55e" /> },
                    { key: "production_enabled", label: "Production Module", desc: "BOM, work orders, processes, sub-contracts", color: "#f59e0b", icon: <Factory size={28} color="#f59e0b" /> },
                    { key: "inventory_enabled", label: "Inventory Module", desc: "Item master, stock transactions, warehouse", color: "#8b5cf6", icon: <Package size={28} color="#8b5cf6" /> },
                    { key: "dispatch_enabled", label: "Dispatch Module", desc: "Shipping, delivery tracking, logistics", color: "#06b6d4", icon: <Truck size={28} color="#06b6d4" /> },
                    { key: "copilot_enabled", label: "AI Copilot", desc: "Data insights, natural language queries", color: "#ec4899", icon: <Sparkles size={28} color="#ec4899" /> },
                ].map((mod) => (
                    <div
                        key={mod.key}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 20px",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            background: "#fafafa",
                            transition: "all 0.2s",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 32, display: "flex", justifyContent: "center" }}>{mod.icon}</div>
                            <div>
                                <Text strong style={{ fontSize: 14, color: "#1f2937" }}>{mod.label}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>{mod.desc}</Text>
                            </div>
                        </div>
                        <Form.Item name={`modules__${mod.key}`} valuePropName="checked" style={{ margin: 0 }}>
                            <Switch
                                checkedChildren="ON"
                                unCheckedChildren="OFF"
                                onChange={() => setDirty(true)}
                            />
                        </Form.Item>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderNumberingSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Document Numbering Series"
                subtitle="Configure prefix and starting number for each document type. The system auto-increments from the 'Next Number' value."
                color="#06b6d4"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                    { prefix: "sales_order_prefix", next: "sales_order_next", label: "Sales Order", sample: "SO-", icon: <ClipboardList size={22} color="#0f172a" /> },
                    { prefix: "purchase_order_prefix", next: "purchase_order_next", label: "Purchase Order", sample: "PO-", icon: <FileText size={22} color="#0f172a" /> },
                    { prefix: "work_order_prefix", next: "work_order_next", label: "Work Order", sample: "WO-", icon: <Wrench size={22} color="#0f172a" /> },
                    { prefix: "dispatch_prefix", next: "dispatch_next", label: "Dispatch / Challan", sample: "DC-", icon: <Truck size={22} color="#0f172a" /> },
                    { prefix: "invoice_prefix", next: "invoice_next", label: "Invoice", sample: "INV-", icon: <Coins size={22} color="#0f172a" /> },
                    { prefix: "grn_prefix", next: "grn_next", label: "Goods Receipt Note", sample: "GRN-", icon: <Inbox size={22} color="#0f172a" /> },
                ].map((item) => (
                    <div
                        key={item.prefix}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "200px 1fr 1fr 200px",
                            alignItems: "center",
                            gap: 16,
                            padding: "14px 20px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#fafafa",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "center", width: 26 }}>{item.icon}</div>
                            <Text strong style={{ fontSize: 14 }}>{item.label}</Text>
                        </div>
                        <FormField name={`numbering__${item.prefix}`} label="Prefix" compact>
                            <Input placeholder={item.sample} style={{ fontFamily: "monospace" }} />
                        </FormField>
                        <FormField name={`numbering__${item.next}`} label="Next Number" compact>
                            <InputNumber min={1} style={{ width: "100%", fontFamily: "monospace" }} />
                        </FormField>
                        <div style={{ textAlign: "center" }}>
                            <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 13 }}>
                                Preview: {form.getFieldValue(`numbering__${item.prefix}`) || item.sample}
                                {String(form.getFieldValue(`numbering__${item.next}`) || 1).padStart(4, "0")}
                            </Tag>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTaxSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Tax & Currency"
                subtitle="Configure default tax rates, tax type, and rounding behavior for all documents."
                color="#f59e0b"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField name="tax__tax_type" label="Tax System">
                    <Select
                        size="large"
                        options={[
                            { value: "GST", label: "GST — Goods & Services Tax (India)" },
                            { value: "VAT", label: "VAT — Value Added Tax" },
                            { value: "SALES_TAX", label: "Sales Tax" },
                            { value: "NONE", label: "No Tax" },
                        ]}
                    />
                </FormField>
                <FormField name="tax__default_tax_rate" label="Default Tax Rate (%)">
                    <InputNumber min={0} max={100} step={0.5} size="large" style={{ width: "100%" }}
                        addonAfter="%" />
                </FormField>
                <FormField name="tax__tax_id_label" label="Tax ID Label">
                    <Input placeholder="GSTIN" size="large" />
                </FormField>
                <div /> {/* spacer */}
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <Title level={5} style={{ margin: 0, color: "#374151", fontWeight: 600 }}>
                Advanced Tax Options
            </Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <ToggleCard name="tax__enable_tds" label="Enable TDS" desc="Tax Deducted at Source" />
                <ToggleCard name="tax__enable_tcs" label="Enable TCS" desc="Tax Collected at Source" />
                <ToggleCard name="tax__round_off_total" label="Round Off Totals" desc="Round document amounts to nearest ₹" />
            </div>
        </div>
    );

    const renderUsersSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Users & Permissions"
                subtitle="Overview of system roles and quick access to user management."
                color="#10b981"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                    { role: "Admin", desc: "Full system access, manage users & settings", color: "#ef4444", icon: <ShieldCheck size={20} /> },
                    { role: "Director", desc: "View all modules, approve high-value transactions", color: "#8b5cf6", icon: <Users size={20} /> },
                    { role: "Production Manager", desc: "Manage BOMs, work orders, production processes", color: "#f59e0b", icon: <Package size={20} /> },
                    { role: "Warehouse Manager", desc: "Inventory control, stock adjustments, GRN", color: "#06b6d4", icon: <Package size={20} /> },
                    { role: "Sales", desc: "Create and manage sales orders, quotations", color: "#3b82f6", icon: <Users size={20} /> },
                    { role: "Purchase Manager", desc: "Manage purchase orders, supplier invoices", color: "#22c55e", icon: <Users size={20} /> },
                    { role: "Finance", desc: "Invoicing, payments, tax reports", color: "#ec4899", icon: <Receipt size={20} /> },
                ].map((r) => (
                    <div
                        key={r.role}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "16px 20px",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            background: "#fafafa",
                        }}
                    >
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: `${r.color}15`, color: r.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {r.icon}
                        </div>
                        <div>
                            <Text strong style={{ color: "#1f2937" }}>{r.role}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>{r.desc}</Text>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                <Button type="primary" size="large" onClick={() => window.location.href = "/app/users"}
                    style={{ borderRadius: 10, padding: "0 32px", height: 44 }}>
                    Manage Users & Roles →
                </Button>
            </div>
        </div>
    );

    const renderNotificationsSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Email & Notifications"
                subtitle="Configure SMTP mail server for outgoing emails and system notification preferences."
                color="#ef4444"
            />
            <Title level={5} style={{ margin: 0, color: "#374151", fontWeight: 600 }}>
                SMTP Mail Server
            </Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField name="notifications__smtp_host" label="SMTP Host">
                    <Input placeholder="smtp.gmail.com" size="large" />
                </FormField>
                <FormField name="notifications__smtp_port" label="SMTP Port">
                    <InputNumber min={1} max={65535} size="large" style={{ width: "100%" }} />
                </FormField>
                <FormField name="notifications__smtp_user" label="SMTP Username">
                    <Input placeholder="noreply@company.com" size="large" />
                </FormField>
                <FormField name="notifications__smtp_password" label="SMTP Password">
                    <Input.Password placeholder="••••••••" size="large" />
                </FormField>
                <FormField name="notifications__notification_email" label="Notification Recipient Email">
                    <Input placeholder="admin@company.com" size="large" />
                </FormField>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <Title level={5} style={{ margin: 0, color: "#374151", fontWeight: 600 }}>
                Notification Rules
            </Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ToggleCard name="notifications__email_on_order_create" label="Email on New Order" desc="Send notification when an order is created" />
                <ToggleCard name="notifications__email_on_dispatch" label="Email on Dispatch" desc="Notify when items are shipped" />
                <ToggleCard name="notifications__low_stock_alert" label="Low Stock Alert" desc="Alert when stock falls below threshold" />
                <FormField name="notifications__low_stock_threshold" label="Low Stock Threshold (qty)">
                    <InputNumber min={0} size="large" style={{ width: "100%" }} />
                </FormField>
            </div>
        </div>
    );

    const renderWorkflowSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="Workflow & Approvals"
                subtitle="Configure approval requirements and auto-confirmation rules for different document types."
                color="#ec4899"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Purchase Order Approvals */}
                <Card
                    size="small"
                    title={<span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><FileText size={18} /> Purchase Order Approvals</span>}
                    style={{ borderRadius: 12 }}
                >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <ToggleCard name="workflow__po_approval_required" label="Require PO Approval" desc="POs must be approved before submission" />
                        <FormField name="workflow__po_approval_threshold" label="Auto-Approve Below (₹)">
                            <InputNumber min={0} step={1000} size="large" style={{ width: "100%" }}
                                formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            />
                        </FormField>
                    </div>
                </Card>
                {/* Sales Order Approvals */}
                <Card
                    size="small"
                    title={<span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={18} /> Sales Order Approvals</span>}
                    style={{ borderRadius: 12 }}
                >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <ToggleCard name="workflow__so_approval_required" label="Require SO Approval" desc="SOs must be approved before confirmation" />
                        <FormField name="workflow__so_approval_threshold" label="Auto-Approve Below (₹)">
                            <InputNumber min={0} step={1000} size="large" style={{ width: "100%" }}
                                formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            />
                        </FormField>
                    </div>
                </Card>
                {/* Dispatch & General */}
                <Card
                    size="small"
                    title={<span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Truck size={18} /> Dispatch & General</span>}
                    style={{ borderRadius: 12 }}
                >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <ToggleCard name="workflow__dispatch_approval_required" label="Dispatch Approval" desc="Require approval before dispatch" />
                        <ToggleCard name="workflow__auto_confirm_orders" label="Auto-Confirm Orders" desc="Skip confirmation step on creation" />
                    </div>
                </Card>
            </div>
        </div>
    );

    const renderSystemSection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <SectionHeader
                title="System / General"
                subtitle="Global application preferences — date formats, timezone, session management, and maintenance mode."
                color="#64748b"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField name="system__date_format" label="Date Format">
                    <Select
                        size="large"
                        options={[
                            { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2026)" },
                            { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2026)" },
                            { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-31)" },
                            { value: "DD-MMM-YYYY", label: "DD-MMM-YYYY (31-Dec-2026)" },
                        ]}
                    />
                </FormField>
                <FormField name="system__timezone" label="Timezone">
                    <Select
                        size="large"
                        showSearch
                        options={[
                            { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
                            { value: "UTC", label: "UTC (+00:00)" },
                            { value: "America/New_York", label: "America/New_York (EST)" },
                            { value: "Europe/London", label: "Europe/London (GMT)" },
                            { value: "Asia/Dubai", label: "Asia/Dubai (GST +04:00)" },
                            { value: "Asia/Singapore", label: "Asia/Singapore (SGT +08:00)" },
                        ]}
                    />
                </FormField>
                <FormField name="system__items_per_page" label="Items Per Page (default pagination)">
                    <Select
                        size="large"
                        options={[
                            { value: 10, label: "10 items" },
                            { value: 25, label: "25 items" },
                            { value: 50, label: "50 items" },
                            { value: 100, label: "100 items" },
                        ]}
                    />
                </FormField>
                <FormField name="system__session_timeout_minutes" label="Session Timeout (minutes)">
                    <InputNumber min={5} max={1440} size="large" style={{ width: "100%" }} />
                </FormField>
                <FormField name="system__backup_frequency" label="Auto Backup Frequency">
                    <Select
                        size="large"
                        options={[
                            { value: "hourly", label: "Every Hour" },
                            { value: "daily", label: "Daily" },
                            { value: "weekly", label: "Weekly" },
                            { value: "disabled", label: "Disabled" },
                        ]}
                    />
                </FormField>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <Title level={5} style={{ margin: 0, color: "#374151", fontWeight: 600 }}>
                System Flags
            </Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ToggleCard name="system__enable_audit_log" label="Audit Logging" desc="Record all document changes for compliance" />
                <ToggleCard name="system__maintenance_mode" label="Maintenance Mode" desc="Lock out non-admin users" danger />
            </div>
        </div>
    );

    const renderSectionContent = () => {
        switch (activeSection) {
            case "company":
                return renderCompanySection();
            case "modules":
                return renderModulesSection();
            case "numbering":
                return renderNumberingSection();
            case "tax":
                return renderTaxSection();
            case "users":
                return renderUsersSection();
            case "notifications":
                return renderNotificationsSection();
            case "workflow":
                return renderWorkflowSection();
            case "system":
                return renderSystemSection();
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                <Spin size="large" tip="Loading settings..." />
            </div>
        );
    }

    return (
        <div style={{ padding: "24px 28px", maxWidth: "100%", overflowX: "hidden" }}>
            {/* Page Header */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 28, paddingBottom: 20,
                borderBottom: "1px solid #e5e7eb",
            }}>
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
                        <Settings size={26} color="#0f172a" /> Settings
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: "block" }}>
                        Configure your ERP system preferences, modules, and integrations
                    </Text>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <Tooltip title="Reload settings from server">
                        <Button
                            icon={<RefreshCw size={16} />}
                            onClick={loadSettings}
                            style={{ borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}
                        >
                            Reload
                        </Button>
                    </Tooltip>
                    <Button
                        type="primary"
                        icon={<Save size={16} />}
                        loading={saving}
                        onClick={handleSave}
                        disabled={!dirty}
                        style={{
                            borderRadius: 8, height: 40, padding: "0 24px",
                            display: "flex", alignItems: "center", gap: 8,
                            background: dirty ? "#1677ff" : undefined,
                            boxShadow: dirty ? "0 2px 8px rgba(22, 119, 255, 0.3)" : undefined,
                        }}
                    >
                        Save Changes
                    </Button>
                    {dirty && (
                        <Badge status="warning" text={<Text type="warning" style={{ fontSize: 12 }}>Unsaved changes</Text>} />
                    )}
                </div>
            </div>

            {/* Layout: Sidebar + Content */}
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, minHeight: "calc(100vh - 200px)" }}>
                {/* Sidebar Navigation */}
                <div style={{
                    display: "flex", flexDirection: "column", gap: 4,
                    background: "#f8fafc", borderRadius: 14,
                    padding: "16px 12px", border: "1px solid #e2e8f0",
                    height: "fit-content", position: "sticky", top: 24,
                }}>
                    <Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", padding: "8px 14px 6px" }}>
                        Configuration
                    </Text>
                    {SECTIONS.map((section) => {
                        const isActive = activeSection === section.key;
                        return (
                            <button
                                key={section.key}
                                onClick={() => setActiveSection(section.key)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "12px 14px", borderRadius: 10,
                                    border: "none", cursor: "pointer",
                                    background: isActive ? "#ffffff" : "transparent",
                                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                    textAlign: "left", width: "100%",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.background = "#f1f5f9";
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 9,
                                    background: isActive ? `${section.color}12` : "#e2e8f0",
                                    color: isActive ? section.color : "#64748b",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.2s",
                                    flexShrink: 0,
                                }}>
                                    {section.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 14, fontWeight: isActive ? 600 : 500,
                                        color: isActive ? "#0f172a" : "#475569",
                                    }}>
                                        {section.label}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {section.description}
                                    </div>
                                </div>
                                {isActive && (
                                    <ChevronRight size={16} style={{ color: section.color, flexShrink: 0 }} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content Panel */}
                <Card
                    style={{
                        borderRadius: 14, border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        minHeight: 500,
                    }}
                    styles={{ body: { padding: "28px 32px" } }}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onValuesChange={() => setDirty(true)}
                    >
                        {renderSectionContent()}
                    </Form>
                </Card>
            </div>

            {/* Inline styles for smooth transitions */}
            <style>{`
                .settings-section-enter {
                    opacity: 0;
                    transform: translateY(8px);
                }
                .settings-section-enter-active {
                    opacity: 1;
                    transform: translateY(0);
                    transition: all 0.3s ease;
                }
            `}</style>
        </div>
    );
}

// ─── Helper Sub-Components ───────────────────────────────────────

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
    return (
        <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 24, borderRadius: 4, background: color }} />
                <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>{title}</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 14, paddingLeft: 14 }}>{subtitle}</Text>
        </div>
    );
}

function FormField({ name, label, children, required, compact }: {
    name: string;
    label: string;
    children: React.ReactNode;
    required?: boolean;
    compact?: boolean;
}) {
    return (
        <Form.Item
            name={name}
            label={<span style={{ fontWeight: 500, color: "#374151", fontSize: compact ? 12 : 14 }}>{label}</span>}
            rules={required ? [{ required: true, message: `${label} is required` }] : undefined}
            style={{ marginBottom: compact ? 0 : 16 }}
        >
            {children}
        </Form.Item>
    );
}

function ToggleCard({ name, label, desc, danger }: {
    name: string;
    label: string;
    desc: string;
    danger?: boolean;
}) {
    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 10,
            border: `1px solid ${danger ? "#fecaca" : "#e5e7eb"}`,
            background: danger ? "#fef2f2" : "#fafafa",
        }}>
            <div>
                <Text strong style={{ color: danger ? "#dc2626" : "#1f2937", fontSize: 14 }}>{label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
            </div>
            <Form.Item name={name} valuePropName="checked" style={{ margin: 0 }}>
                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
            </Form.Item>
        </div>
    );
}
