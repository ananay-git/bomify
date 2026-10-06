import { useEffect, useState, useCallback } from "react";
import {
    Typography,
    Card,
    Row,
    Col,
    Table,
    Spin,
    message,
    Button,
    Tabs,
    Tooltip,
    Statistic,
} from "antd";
import {
    ReloadOutlined,
    ArrowRightOutlined,
    QuestionCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import {
    inventoryApi,
    InventoryDashboard,
    StockLevelSummary,
} from "@/features/inventory/api";

const { Title, Text } = Typography;

const formatCurrency = (val: number) =>
    `₹${(val || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatShortCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
    return formatCurrency(val);
};

/* ── Stock Level Card ── */
function StockLevelCard({
    label,
    count,
    total,
    color,
    borderColor,
    active,
    onClick,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
    borderColor: string;
    active?: boolean;
    onClick?: () => void;
}) {
    const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
    return (
        <div
            onClick={onClick}
            style={{
                border: `1.5px solid ${active ? borderColor : "#e8e8e8"}`,
                borderRadius: 8,
                padding: "16px 20px",
                cursor: "pointer",
                background: active ? `${borderColor}08` : "#fff",
                transition: "all 0.2s",
                minHeight: 90,
            }}
        >
            <Text style={{ fontSize: 12, color: "#8c8c8c", display: "block" }}>
                {label}
            </Text>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <Text strong style={{ fontSize: 24, color }}>
                    {count}
                </Text>
                <Text style={{ fontSize: 12, color: "#8c8c8c" }}>({pct}%)</Text>
            </div>
        </div>
    );
}

/* ── Section wrapper ── */
function Section({
    title,
    extra,
    children,
    style,
}: {
    title: string;
    extra?: React.ReactNode;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <Card
            style={{
                borderRadius: 8,
                marginBottom: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                ...style,
            }}
            styles={{ body: { padding: "24px 28px" } }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                }}
            >
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>
                    {title}
                </Title>
                {extra}
            </div>
            {children}
        </Card>
    );
}

export default function InventoryDashboardPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<InventoryDashboard | null>(null);
    const [activeStockLevel, setActiveStockLevel] = useState<string>("negative_stock");
    const [valuationTab, setValuationTab] = useState<string>("category");

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const d = await inventoryApi.getDashboard();
            setData(d);
        } catch {
            message.error("Failed to load inventory dashboard");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    if (loading || !data) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
                <Spin size="large" />
            </div>
        );
    }

    const lastUpdated = new Date(data.last_updated).toLocaleString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    const stockLevelCards: {
        key: keyof StockLevelSummary;
        label: string;
        color: string;
        borderColor: string;
    }[] = [
        { key: "negative_stock", label: "Negative Stock", color: "#cf1322", borderColor: "#cf1322" },
        { key: "low_stock", label: "Low Stock", color: "#d4380d", borderColor: "#d4380d" },
        { key: "reorder_stock", label: "Reorder Stock", color: "#d48806", borderColor: "#d48806" },
        { key: "optimum_stock", label: "Optimum Stock", color: "#389e0d", borderColor: "#389e0d" },
        { key: "high_stock", label: "High Stock", color: "#096dd9", borderColor: "#096dd9" },
        { key: "excess_stock", label: "Excess Stock", color: "#531dab", borderColor: "#531dab" },
    ];

    /* ── Top items tables ── */
    const sellingCols = [
        { title: "Item Name", dataIndex: "item_name", key: "item_name", width: "40%" },
        { title: "# Invoices", dataIndex: "invoices", key: "invoices", width: "20%", align: "center" as const },
        {
            title: "Traded Amount",
            dataIndex: "traded_amount",
            key: "traded_amount",
            width: "40%",
            align: "right" as const,
            render: (v: number) => formatCurrency(v),
        },
    ];

    const purchasedCols = [
        { title: "Item Name", dataIndex: "item_name", key: "item_name", width: "40%" },
        { title: "# Orders", dataIndex: "invoices", key: "invoices", width: "20%", align: "center" as const },
        {
            title: "Traded Amount",
            dataIndex: "traded_amount",
            key: "traded_amount",
            width: "40%",
            align: "right" as const,
            render: (v: number) => formatCurrency(v),
        },
    ];

    /* ── Category valuation chart data ── */
    const categoryChartData = data.valuation_by_category.map((c) => ({
        name: c.category.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
        value: c.value,
        count: c.count,
    }));

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
            {/* ── Page Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                        Inventory Dashboard
                    </Title>
                </div>
                <Button type="link" onClick={() => navigate("/app/inventory")} style={{ color: "#008b8b", fontWeight: 500 }}>
                    All Features <ArrowRightOutlined />
                </Button>
            </div>

            {/* ── Inventory Overview ── */}
            <Section
                title="Inventory Overview"
                extra={
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
                            Last updated: {lastUpdated}
                        </Text>
                        <Button
                            type="link"
                            icon={<ReloadOutlined />}
                            onClick={fetchDashboard}
                            style={{ color: "#008b8b", padding: 0 }}
                        >
                            Refresh
                        </Button>
                    </div>
                }
            >
                {/* Stock Valuation Summary Table */}
                <Table
                    dataSource={[
                        {
                            key: "valuation",
                            label: "Stock Valuation",
                            value: data.stock_valuation_value,
                            count: data.stock_valuation_count,
                        },
                    ]}
                    columns={[
                        {
                            title: "",
                            dataIndex: "label",
                            key: "label",
                            render: (v: string) => (
                                <Text strong>
                                    {v}{" "}
                                    <Tooltip title="Based on default price × current stock">
                                        <QuestionCircleOutlined style={{ color: "#bfbfbf" }} />
                                    </Tooltip>
                                </Text>
                            ),
                        },
                        {
                            title: "Value",
                            dataIndex: "value",
                            key: "value",
                            align: "right",
                            render: (v: number) => <Text strong>{formatShortCurrency(v)}</Text>,
                        },
                        {
                            title: "Count",
                            dataIndex: "count",
                            key: "count",
                            align: "right",
                            render: (v: number) => <Text strong>{v}</Text>,
                        },
                    ]}
                    pagination={false}
                    size="small"
                    bordered
                    style={{ marginBottom: 28 }}
                />

                {/* Top Selling & Purchased side-by-side */}
                <Row gutter={24}>
                    <Col span={12}>
                        <Text strong style={{ color: "#262626", fontSize: 13, display: "block", marginBottom: 12 }}>
                            Top 5 Selling Items (Last 3 months){" "}
                            <Tooltip title="Based on sales order line items in the last 90 days">
                                <QuestionCircleOutlined style={{ color: "#bfbfbf" }} />
                            </Tooltip>
                        </Text>
                        <Table
                            dataSource={data.top_selling_items}
                            columns={sellingCols}
                            rowKey="item_id"
                            pagination={false}
                            size="small"
                            bordered
                            locale={{ emptyText: "No sales data yet" }}
                        />
                    </Col>
                    <Col span={12}>
                        <Text strong style={{ color: "#262626", fontSize: 13, display: "block", marginBottom: 12 }}>
                            Top 5 Purchased Items (Last 3 months){" "}
                            <Tooltip title="Based on purchase orders in the last 90 days">
                                <QuestionCircleOutlined style={{ color: "#bfbfbf" }} />
                            </Tooltip>
                        </Text>
                        <Table
                            dataSource={data.top_purchased_items}
                            columns={purchasedCols}
                            rowKey="item_id"
                            pagination={false}
                            size="small"
                            bordered
                            locale={{ emptyText: "No purchase data yet" }}
                        />
                    </Col>
                </Row>
            </Section>

            {/* ── Stock Level of Items in Inventory ── */}
            <Section
                title="Stock Level of Items in Inventory"
                extra={
                    <Tooltip title="Stock levels are calculated based on min & max stock levels you defined">
                        <QuestionCircleOutlined style={{ color: "#389e0d", fontSize: 18 }} />
                    </Tooltip>
                }
            >
                <Row gutter={[16, 16]}>
                    {stockLevelCards.map((c) => (
                        <Col span={4} key={c.key}>
                            <StockLevelCard
                                label={c.label}
                                count={data.stock_levels[c.key] as number}
                                total={data.stock_levels.total_items}
                                color={c.color}
                                borderColor={c.borderColor}
                                active={activeStockLevel === c.key}
                                onClick={() => setActiveStockLevel(c.key)}
                            />
                        </Col>
                    ))}
                </Row>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "#8c8c8c", fontSize: 13 }}>
                        Total Inventory Items - <Text strong>{data.stock_levels.total_items}</Text>
                    </Text>
                    <Button
                        type="link"
                        onClick={() => navigate("/app/inventory")}
                        style={{ color: "#008b8b", fontSize: 13, padding: 0 }}
                    >
                        Go to Inventory Module <ArrowRightOutlined />
                    </Button>
                </div>

                <Text
                    italic
                    style={{ color: "#008b8b", fontSize: 12, display: "block", marginTop: 8 }}
                >
                    This data is calculated based on minimum stock level and maximum stock level defined by you
                </Text>
            </Section>

            {/* ── Stock Valuation ── */}
            <Section
                title="Stock Valuation"
                extra={
                    <Tooltip title="Stock valuation based on default pricing">
                        <QuestionCircleOutlined style={{ color: "#389e0d", fontSize: 18 }} />
                    </Tooltip>
                }
            >
                <Row gutter={24} style={{ marginBottom: 20 }}>
                    <Col span={8}>
                        <Statistic title="Total Items" value={data.stock_valuation_count} />
                    </Col>
                    <Col span={16}>
                        <Statistic
                            title="Stock Valuation"
                            value={data.stock_valuation_value}
                            prefix="₹"
                            precision={2}
                            suffix={
                                <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
                                    {" "}(Based on Default Pricing)
                                </Text>
                            }
                        />
                    </Col>
                </Row>

                <Tabs
                    activeKey={valuationTab}
                    onChange={setValuationTab}
                    items={[
                        {
                            key: "category",
                            label: "Category",
                            children: (
                                <div style={{ height: 300 }}>
                                    {categoryChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={categoryChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                <YAxis
                                                    tick={{ fontSize: 12 }}
                                                    tickFormatter={(v: number) => formatShortCurrency(v)}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: unknown) => [formatCurrency(Number(value)), "Value"]}
                                                />
                                                <Bar dataKey="value" fill="#008b8b" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#bfbfbf" }}>
                                            <Text>No data available</Text>
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: "count",
                            label: "Item Count",
                            children: (
                                <div style={{ height: 300 }}>
                                    {categoryChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={categoryChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} />
                                                <RechartsTooltip />
                                                <Bar dataKey="count" fill="#1890ff" radius={[4, 4, 0, 0]} maxBarSize={60} name="Items" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#bfbfbf" }}>
                                            <Text>No data available</Text>
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            </Section>

            {/* ── Inventory Performance (placeholder with stock transactions) ── */}
            <Section
                title="Inventory Performance"
                extra={
                    <Tooltip title="Stock movement over time based on transactions">
                        <QuestionCircleOutlined style={{ color: "#389e0d", fontSize: 18 }} />
                    </Tooltip>
                }
            >
                <div style={{ height: 300, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickFormatter={(v: number) => formatShortCurrency(v)}
                            />
                            <RechartsTooltip formatter={(value: unknown) => [formatCurrency(Number(value))]} />
                            <Legend />
                            <Line type="monotone" dataKey="inwards" stroke="#389e0d" name="Inwards" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="outwards" stroke="#cf1322" name="Outwards" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <Text style={{ color: "#8c8c8c", fontSize: 12, display: "block", textAlign: "center", marginTop: 8 }}>
                    Performance chart will populate as stock transactions are recorded
                </Text>
            </Section>
        </div>
    );
}
