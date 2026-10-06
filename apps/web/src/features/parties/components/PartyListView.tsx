import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Table, Button, Modal, Form, Input, Typography, Drawer, Select, Dropdown, Tag, Space, Row, Col } from 'antd';
import { message } from '@/lib/antdHelper';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined, MoreOutlined, ExportOutlined, FilterOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { fetchParties, updateParty, deleteParty } from "@/features/parties/api/parties";
import type { Party, UpdatePartyPayload, PartyType } from "@/features/parties/api/parties";
import { extractApiError } from "@/lib/errors";
import type { MenuProps } from "antd";
import AddCompanyForm from "../../../components/layout/AddCompanyForm";

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

interface PartyListViewProps {
    partyType: PartyType | "both";
    title: string;
}

function PartyFormFields() {
    return (
        <div className="space-y-4">
            <Form.Item name="name" label={<span className="font-medium text-gray-700">Company Name</span>} rules={[{ required: true }]}><Input size="large" className="rounded-md" /></Form.Item>
            <Form.Item name="contact_person" label={<span className="font-medium text-gray-700">Contact Person</span>}><Input size="large" className="rounded-md" /></Form.Item>
            <Form.Item name="email" label={<span className="font-medium text-gray-700">Email</span>} rules={[{ type: "email" }]}><Input size="large" className="rounded-md" /></Form.Item>
            <Form.Item name="phone" label={<span className="font-medium text-gray-700">Phone</span>}><Input size="large" className="rounded-md" /></Form.Item>
            <Form.Item name="gstin" label={<span className="font-medium text-gray-700">GSTIN</span>}><Input size="large" className="rounded-md" /></Form.Item>
            <div className="grid grid-cols-2 gap-4">
                <Form.Item name="city" label={<span className="font-medium text-gray-700">City</span>}><Input size="large" className="rounded-md" /></Form.Item>
                <Form.Item name="state" label={<span className="font-medium text-gray-700">State</span>}><Input size="large" className="rounded-md" /></Form.Item>
            </div>
            <Form.Item name="pincode" label={<span className="font-medium text-gray-700">Pincode</span>}><Input size="large" className="rounded-md" /></Form.Item>
            <Form.Item name="address1" label={<span className="font-medium text-gray-700">Address</span>}><TextArea rows={3} className="rounded-md" /></Form.Item>
        </div>
    );
}

export default function PartyListView({ partyType, title }: PartyListViewProps) {
    const [parties, setParties] = useState<Party[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [categoryFilter] = useState<string>("all");
    const [statusFilter] = useState<string>("active");
    const [createOpen, setCreateOpen] = useState(false);
    const [editParty, setEditParty] = useState<Party | null>(null);
    const [editForm] = Form.useForm();
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [searchRowOpen, setSearchRowOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            let fetchType: PartyType | undefined;
            if (categoryFilter !== "all") {
                fetchType = categoryFilter === "both" ? undefined : (categoryFilter as PartyType);
            } else {
                fetchType = partyType === "both" ? undefined : partyType;
            }

            const data = await fetchParties(fetchType, undefined);
            let filteredParties = data.parties;

            if (statusFilter !== "all") {
                filteredParties = filteredParties.filter((p: any) => {
                    const partyStatus = p.status || "active";
                    return partyStatus.toLowerCase() === statusFilter.toLowerCase();
                });
            }

            setParties(filteredParties);
            setTotal(statusFilter !== "all" ? filteredParties.length : data.total);
        } catch (err) {
            message.error(extractApiError(err, `Failed to load ${title.toLowerCase()}`));
        } finally {
            setLoading(false);
        }
    }, [partyType, categoryFilter, statusFilter, title]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => { if (editParty) editForm.setFieldsValue(editParty); }, [editParty, editForm]);

    const handleEdit = async (values: UpdatePartyPayload) => {
        if (!editParty) return;
        try {
            await updateParty(editParty.id, values);
            message.success("Company updated successfully");
            setEditParty(null);
            load();
        } catch (err) {
            message.error(extractApiError(err, "Failed to update company"));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteParty(id);
            message.success("Company deleted");
            load();
        } catch (err) {
            message.error(extractApiError(err, "Failed to delete company"));
        }
    };

    const getRowActions = (record: Party): MenuProps["items"] => [
        { key: "edit", icon: <EditOutlined className="text-blue-600" />, label: "Edit", onClick: () => setEditParty(record) },
        { type: "divider" },
        {
            key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true,
            onClick: () => Modal.confirm({
                title: `Delete "${record.name}"?`, content: "This action cannot be undone.", okText: "Yes, Delete", okType: "danger", onOk: () => handleDelete(record.id),
            }),
        },
    ];

    const renderColumnTitle = (colTitle: string, showSearch: boolean = true) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#595959', fontSize: '13px', fontWeight: 600 }}>{colTitle}</span>
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
            title: renderColumnTitle("Company Name"),
            dataIndex: "name",
            key: "name",
            render: (text: string, record: Party) => (
                <Link to={`/app/companies/${record.id}`} style={{ color: '#1890ff', fontWeight: 500 }}>
                    {text} <ExportOutlined style={{ fontSize: '11px', marginLeft: 4 }} />
                </Link>
            ),
        },
        {
            title: renderColumnTitle("Category"),
            dataIndex: "party_type",
            key: "party_type",
            render: (type: string) => (
                <Tag style={{ borderRadius: '16px', background: '#fff', border: `1px solid ${type === "supplier" ? "#722ed1" : "#1890ff"}`, color: type === "supplier" ? "#722ed1" : "#1890ff", padding: '2px 10px' }} className="capitalize">
                    {type === "customer" ? "buyer" : type}
                </Tag>
            ),
        },
        {
            title: renderColumnTitle("Status"),
            dataIndex: "status",
            key: "status",
            render: (status?: string) => {
                const isActive = status !== "inactive";
                return (
                    <Tag style={{ borderRadius: '16px', background: '#fff', border: `1px solid ${isActive ? '#52c41a' : '#d9d9d9'}`, color: isActive ? '#52c41a' : '#595959', padding: '2px 10px' }}>
                        {isActive ? "Active" : "Inactive"}
                    </Tag>
                );
            },
        },
        { title: renderColumnTitle("City"), dataIndex: "city", key: "city" },
        { title: renderColumnTitle("Contact Number"), dataIndex: "phone", key: "phone" },
        {
            title: "",
            key: "action",
            width: 60,
            render: (_: any, record: Party) => (
                <Dropdown menu={{ items: getRowActions(record) }} trigger={["click"]}>
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            ),
        },
    ];

    return (
        <div style={{ padding: '0px 0px 32px 0px', maxWidth: '100%', overflowX: 'hidden' }}>
            <div className="flex justify-between items-center mb-6">
                <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{title}</Title>
                <Space>
                    <Button style={{ color: '#595959', borderColor: '#d9d9d9', fontWeight: 500 }}>Bulk Actions</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                        Add Single Company
                    </Button>
                </Space>
            </div>

            <div className="bg-white rounded-lg border border-gray-200" style={{ padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                {/* Filters Row */}
                <div style={{ marginBottom: '20px' }}>
                    {!moreFiltersOpen ? (
                        <Space size="large" align="center">
                            <div>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Category</Text>
                                <Select defaultValue="all" style={{ width: 160 }}>
                                    <Option value="all">All</Option>
                                </Select>
                            </div>
                            <Button type="link" icon={<FilterOutlined />} onClick={() => setMoreFiltersOpen(true)} style={{ marginTop: '26px', fontWeight: 500 }}>
                                More Filters
                            </Button>
                            <Button type="link" icon={<SearchOutlined />} onClick={() => setSearchRowOpen(!searchRowOpen)} style={{ marginTop: '26px', fontWeight: 500 }}>
                                Search
                            </Button>
                        </Space>
                    ) : (
                        <Row gutter={24} align="bottom">
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Category</Text>
                                <Select defaultValue="all" style={{ width: 160 }}>
                                    <Option value="all">All</Option>
                                    <Option value="customer">Buyer</Option>
                                    <Option value="supplier">Supplier</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Text style={{ display: 'block', fontSize: '13px', color: '#595959', marginBottom: '8px' }}>Status</Text>
                                <Select defaultValue="active" style={{ width: 160 }}>
                                    <Option value="all">All</Option>
                                    <Option value="active">Active</Option>
                                    <Option value="inactive">Inactive</Option>
                                </Select>
                            </Col>
                            <Col>
                                <Button type="link" icon={<SearchOutlined />} onClick={() => setMoreFiltersOpen(false)} style={{ fontWeight: 500 }}>
                                    Close Filters
                                </Button>
                                <Button type="link" icon={<SearchOutlined />} onClick={() => setSearchRowOpen(!searchRowOpen)} style={{ fontWeight: 500 }}>
                                    Search
                                </Button>
                            </Col>
                        </Row>
                    )}
                </div>

                <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 -24px 0 -24px' }} />

                <Table
                    dataSource={parties}
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

            <Modal open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={760} centered destroyOnHidden className="rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                <div className="px-8 py-5 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-semibold text-gray-800 m-0">Add New Company</h2>
                    <p className="text-sm text-gray-500 mt-1 mb-0">Enter the details for your new {partyType}.</p>
                </div>
                <AddCompanyForm initialType={partyType} onCancel={() => setCreateOpen(false)} onSuccess={() => { setCreateOpen(false); load(); }} />
            </Modal>

            <Drawer title={<span className="text-lg font-semibold">Edit: {editParty?.name ?? ""}</span>} open={!!editParty} onClose={() => setEditParty(null)} styles={{ wrapper: { width: 550 } }} extra={<div className="flex gap-2"><Button onClick={() => setEditParty(null)}>Cancel</Button><Button type="primary" onClick={() => editForm.submit()} className="bg-blue-600">Save Changes</Button></div>}>
                <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}><PartyFormFields /></Form>
            </Drawer>

            <style>{`
                .custom-grid-table .ant-table-thead > tr > th { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; }
                .custom-grid-table .ant-table-tbody > tr > td { padding: 16px; }
                .custom-grid-table .ant-table-pagination.ant-pagination { background: #fafafa; border-top: 1px solid #f0f0f0; border-radius: 0 0 8px 8px; margin: 0 !important; padding: 16px 24px !important; }
            `}</style>
        </div>
    );
}
