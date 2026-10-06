import React, { useState, useEffect } from "react";
import { Card, Table, Typography, Button, Descriptions, Tag, Row, Col, Modal, message, Space } from "antd";
import { CheckCircleOutlined, FileTextOutlined, TruckOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { orderConfirmationApi, OrderConfirmation } from "@/features/sales/api";
import { fetchPartyById } from "@/features/parties/api/parties";

const { Title, Text } = Typography;

export default function OrderConfirmationDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [oc, setOc] = useState<OrderConfirmation | null>(null);
    const [buyerName, setBuyerName] = useState("");
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await orderConfirmationApi.getById(Number(id));
            setOc(data);
            if (data.buyer_id) {
                const buyer = await fetchPartyById(data.buyer_id);
                setBuyerName(buyer.name);
            }
        } catch (error) {
            message.error("Failed to load Order Confirmation");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleMarkComplete = () => {
        Modal.confirm({
            title: "Are you sure you want to mark this transaction as complete?",
            content: "This action cannot be undone.",
            onOk: async () => {
                try {
                    await orderConfirmationApi.updateStatus(Number(id), "completed");
                    message.success("Order Confirmation marked as completed.");
                    loadData();
                } catch (error) {
                    message.error("Failed to update status.");
                }
            }
        });
    };

    const handleMakeChallan = () => {
        navigate(`/app/sales/delivery-challan/create?sourceOcId=${id}`);
    };

    const handleMakeInvoice = () => {
        navigate(`/app/sales/invoices/create?sourceOcId=${id}`);
    };

    if (loading || !oc) return <div style={{ padding: 24 }}>Loading...</div>;

    const columns = [
        { title: "Item ID", dataIndex: "item_id", key: "item" },
        { title: "Quantity", dataIndex: "quantity", key: "quantity" },
        { title: "Rate", dataIndex: "rate", key: "rate", render: (val: number) => `₹${val.toFixed(2)}` },
        { title: "Taxable Amount", dataIndex: "taxable_amount", key: "taxable_amount", render: (val: number) => `₹${val.toFixed(2)}` },
        { title: "Total", dataIndex: "total", key: "total", render: (val: number) => `₹${val.toFixed(2)}` },
    ];

    let statusColor = "blue";
    if (oc.status === "completed") statusColor = "green";
    else if (oc.status === "draft") statusColor = "default";

    return (
        <div style={{ padding: '0px 0px 32px 0px' }}>
            <div className="flex justify-between items-center mb-6">
                <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                    Order Confirmation: {oc.doc_number} <Tag color={statusColor}>{oc.status.toUpperCase()}</Tag>
                </Title>
            </div>

            <Card style={{ marginBottom: 24 }}>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Buyer Name">{buyerName}</Descriptions.Item>
                    <Descriptions.Item label="Document Date">{new Date(oc.doc_date).toLocaleDateString()}</Descriptions.Item>
                    <Descriptions.Item label="Delivery Date">{oc.delivery_date ? new Date(oc.delivery_date).toLocaleDateString() : 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Grand Total">₹{(oc.total_amount || 0).toFixed(2)}</Descriptions.Item>
                </Descriptions>
            </Card>

            <Card style={{ marginBottom: 24 }}>
                <Table
                    columns={columns}
                    dataSource={oc.items || []}
                    rowKey="id"
                    pagination={false}
                    bordered
                />
            </Card>

            {oc.notes && (
                <Card style={{ marginBottom: 24 }} title="Notes / Terms">
                    <Text>{oc.notes}</Text>
                </Card>
            )}

            {/* Business Logic Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                {oc.status !== "completed" && (
                    <Button icon={<CheckCircleOutlined />} onClick={handleMarkComplete}>
                        Mark As Complete
                    </Button>
                )}
                <Button icon={<TruckOutlined />} onClick={handleMakeChallan}>
                    Create Challan
                </Button>
                <Button type="primary" icon={<FileTextOutlined />} onClick={handleMakeInvoice}>
                    Create Invoice
                </Button>
            </div>
        </div>
    );
}
