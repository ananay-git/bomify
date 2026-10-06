import { useEffect, useState } from "react";
import { Typography, Card, Row, Col, Statistic, Table, Button, Spin, Tag } from "antd";
import {
    ShoppingCartOutlined,
    ShopOutlined,
    TeamOutlined,
    FileTextOutlined,
    ArrowRightOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { purchasesApi, PurchaseStats } from "@/features/purchases/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

interface ShortcutCard {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: string;
}

const shortcuts: ShortcutCard[] = [
    {
        title: "Buyers",
        description: "Manage your buyers",
        icon: <ShoppingCartOutlined style={{ fontSize: 24 }} />,
        path: "/app/selling/customers",
        color: "#3B82F6",
    },
    {
        title: "Suppliers",
        description: "Manage your vendors",
        icon: <ShopOutlined style={{ fontSize: 24 }} />,
        path: "/app/buying/parties",
        color: "#22C55E",
    },
    {
        title: "Create Purchase",
        description: "New purchase order",
        icon: <FileTextOutlined style={{ fontSize: 24 }} />,
        path: "/app/purchases/create",
        color: "#F59E0B",
    },
    {
        title: "Users & Roles",
        description: "Manage system users",
        icon: <TeamOutlined style={{ fontSize: 24 }} />,
        path: "/app/users",
        color: "#8B5CF6",
    },
];

export default function DashboardPage() {
    const navigate = useNavigate();
    const [purchaseStats, setPurchaseStats] = useState<PurchaseStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoadingStats(true);
                const stats = await purchasesApi.getStats();
                setPurchaseStats(stats);
            } catch (error) {
                console.error("Failed to load purchase stats", error);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStats();
    }, []);

    const recentOrderColumns = [
        {
            title: 'Order No',
            dataIndex: 'po_number',
            key: 'po_number',
            render: (text: string, record: any) => (
                <a onClick={() => navigate(`/app/purchases/${record.id}`)} style={{ fontWeight: 500, color: '#1677ff' }}>
                    {text}
                </a>
            ),
        },
        {
            title: 'Supplier',
            dataIndex: 'supplier_name',
            key: 'supplier_name',
            render: (text: string) => text || 'Unknown',
        },
        {
            title: 'Date',
            dataIndex: 'order_date',
            key: 'order_date',
            render: (date: string) => dayjs(date).format('DD MMM YYYY'),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colorMap: Record<string, string> = {
                    draft: 'default',
                    sent: 'blue',
                    completed: 'green',
                    cancelled: 'red',
                };
                return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
            },
        },
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Page Header */}
            <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#1f2937' }}>
                    Overview Dashboard
                </Title>
            </div>

            {/* Purchase Operations Summary */}
            <Title level={5} style={{ margin: '0 0 16px 0', fontWeight: 600, color: '#374151' }}>
                Purchasing Operations Summary
            </Title>
            
            {loadingStats ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spin /></div>
            ) : purchaseStats ? (
                <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                    <Col xs={24} sm={12} md={6}>
                        <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Statistic 
                                title="Total Purchase Orders" 
                                value={purchaseStats.total_orders} 
                                valueStyle={{ color: '#3f8600', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Statistic 
                                title="Pending Deliveries" 
                                value={purchaseStats.pending_deliveries} 
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ color: '#d48806', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Statistic 
                                title="Completed Orders" 
                                value={purchaseStats.status_counts['completed'] || 0} 
                                prefix={<CheckCircleOutlined />}
                                valueStyle={{ color: '#1677ff', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Statistic 
                                title="Total Value" 
                                value={purchaseStats.total_value} 
                                prefix="₹"
                                precision={2}
                                valueStyle={{ color: '#1f2937', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                </Row>
            ) : null}

            <Row gutter={[24, 24]}>
                {/* Recent Purchases Table */}
                <Col xs={24} lg={16}>
                    <Card 
                        title={<span style={{ fontWeight: 600, color: '#374151' }}>Recent Purchases</span>} 
                        style={{ borderRadius: 12, height: '100%' }}
                        extra={<Button type="link" onClick={() => navigate('/app/purchases')} icon={<ArrowRightOutlined />}>View All</Button>}
                    >
                        {purchaseStats?.recent_orders && (
                            <Table 
                                columns={recentOrderColumns} 
                                dataSource={purchaseStats.recent_orders} 
                                rowKey="id" 
                                pagination={false}
                                size="small"
                                scroll={{ x: 'max-content' }}
                            />
                        )}
                        {(!purchaseStats?.recent_orders || purchaseStats.recent_orders.length === 0) && !loadingStats && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                                No recent orders found
                            </div>
                        )}
                    </Card>
                </Col>

                {/* Shortcuts & Quick Actions */}
                <Col xs={24} lg={8}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Title level={5} style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
                            Quick Actions
                        </Title>
                        {shortcuts.map((s) => (
                            <Card
                                key={s.title}
                                hoverable
                                onClick={() => navigate(s.path)}
                                style={{ borderRadius: 12, borderLeft: `4px solid ${s.color}`, cursor: 'pointer' }}
                                styles={{ body: { padding: 16, display: 'flex', alignItems: 'center', gap: 16 } }}
                            >
                                <div style={{ color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {s.icon}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <Text strong style={{ fontSize: 14, color: '#1f2937' }}>{s.title}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{s.description}</Text>
                                </div>
                            </Card>
                        ))}
                    </div>
                </Col>
            </Row>
        </div>
    );
}
