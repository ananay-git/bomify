import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Tag, Spin, Modal, Dropdown, Avatar, Form, Input, Select, Empty } from 'antd';
import { message } from '@/lib/antdHelper';
import {
    ArrowLeftOutlined,
    EditOutlined,
    DeleteOutlined,
    MailOutlined,
    PhoneOutlined,
    PlusOutlined,
    MoreOutlined,
    QuestionCircleOutlined,
    BankOutlined,
    EnvironmentOutlined,
    WalletOutlined,
    IdcardOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

import {
    fetchPartyById,
    deleteParty,
    updateParty,
    addPartyLocation,
    updatePartyLocation,
    deletePartyLocation,
    addPartyContact,
    updatePartyContact,
    deletePartyContact,
    addPartyTag,
    deletePartyTag,
} from "@/features/parties/api/parties";

import type {
    Party,
    UpdatePartyPayload,
    Location,
    PartyContact,
} from "@/features/parties/api/parties";
import { extractApiError } from "@/lib/errors";

export default function PartyDetailView() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState("primary");
    const [party, setParty] = useState<Party | null>(null);

    // Modal Visibility States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    // Track which item is being edited (null means creating new)
    const [editingContactId, setEditingContactId] = useState<number | null>(
        null,
    );
    const [editingAddressId, setEditingAddressId] = useState<number | null>(
        null,
    );

    const [editForm] = Form.useForm();
    const [tagForm] = Form.useForm();
    const [contactForm] = Form.useForm();
    const [addressForm] = Form.useForm();

    const loadPartyDetails = async () => {
        if (!id) return;
        try {
            const data = await fetchPartyById(id);
            setParty(data);
            editForm.setFieldsValue(data);
        } catch (err) {
            message.error(
                extractApiError(err, "Failed to load company details"),
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPartyDetails();
    }, [id, editForm]);

    // --------------------------------------------------------
    // MAIN COMPANY CRUD
    // --------------------------------------------------------
    const handleDeleteCompany = () => {
        Modal.confirm({
            title: `Delete "${party?.name}"?`,
            content: "This action cannot be undone.",
            okText: "Yes, Delete",
            okType: "danger",
            onOk: async () => {
                try {
                    await deleteParty(party!.id);
                    message.success("Company deleted successfully");
                    navigate(-1);
                } catch (err) {
                    message.error(extractApiError(err, "Failed to delete"));
                }
            },
        });
    };

    const handleUpdateCompany = async (values: UpdatePartyPayload) => {
        try {
            await updateParty(party!.id, values);
            message.success("Company updated");
            setIsEditModalOpen(false);
            loadPartyDetails();
        } catch (err) {
            message.error(extractApiError(err, "Update failed"));
        }
    };

    // --------------------------------------------------------
    // TAGS CRUD
    // --------------------------------------------------------
    const handleAddTag = async (values: { tag: string }) => {
        try {
            await addPartyTag(party!.id, values.tag);
            message.success(`Tag added!`);
            tagForm.resetFields();
            setIsTagModalOpen(false);
            loadPartyDetails();
        } catch (err) {
            message.error("Failed to add tag");
        }
    };

    const handleRemoveTag = async (tagId: number) => {
        try {
            await deletePartyTag(party!.id, tagId);
            message.success("Tag removed");
            loadPartyDetails();
        } catch (err) {
            message.error("Failed to remove tag");
        }
    };

    // --------------------------------------------------------
    // CONTACTS CRUD
    // --------------------------------------------------------
    const openAddContact = () => {
        setEditingContactId(null);
        contactForm.resetFields();
        setIsContactModalOpen(true);
    };
    const openEditContact = (contact: PartyContact) => {
        setEditingContactId(contact.id!);
        contactForm.setFieldsValue(contact);
        setIsContactModalOpen(true);
    };
    const handleSaveContact = async (values: PartyContact) => {
        try {
            if (editingContactId) {
                await updatePartyContact(party!.id, editingContactId, values);
                message.success("Contact updated!");
            } else {
                await addPartyContact(party!.id, values);
                message.success("Contact added!");
            }
            setIsContactModalOpen(false);
            loadPartyDetails();
        } catch (err) {
            message.error("Failed to save contact");
        }
    };
    const handleDeleteContact = async (contactId: number) => {
        Modal.confirm({
            title: "Delete Contact?",
            okType: "danger",
            onOk: async () => {
                await deletePartyContact(party!.id, contactId);
                message.success("Contact deleted");
                loadPartyDetails();
            },
        });
    };

    // --------------------------------------------------------
    // ADDRESSES CRUD
    // --------------------------------------------------------
    const openAddAddress = (type: "billing" | "delivery") => {
        setEditingAddressId(null);
        addressForm.resetFields();
        addressForm.setFieldsValue({ location_type: type, country: "India" });
        setIsAddressModalOpen(true);
    };
    const openEditAddress = (addr: Location) => {
        setEditingAddressId(addr.id!);
        addressForm.setFieldsValue(addr);
        setIsAddressModalOpen(true);
    };
    const handleSaveAddress = async (values: Location) => {
        try {
            if (editingAddressId) {
                await updatePartyLocation(party!.id, editingAddressId, values);
                message.success("Address updated!");
            } else {
                await addPartyLocation(party!.id, values);
                message.success("Address added!");
            }
            setIsAddressModalOpen(false);
            loadPartyDetails();
        } catch (err) {
            message.error("Failed to save address");
        }
    };
    const handleDeleteAddress = async (addrId: number) => {
        Modal.confirm({
            title: "Delete Address?",
            okType: "danger",
            onOk: async () => {
                await deletePartyLocation(party!.id, addrId);
                message.success("Address deleted");
                loadPartyDetails();
            },
        });
    };

    const handleViewLedger = () => {
        message.info("Ledger view routing to be implemented.");
    };

    // --------------------------------------------------------
    // RENDER HELPERS
    // --------------------------------------------------------
    const billingAddresses =
        party?.locations?.filter((a) => a.location_type === "billing") || [];
    const deliveryLocations =
        party?.locations?.filter((a) => a.location_type === "delivery") || [];
    const contactsList = party?.contacts || [];

    const getContactMenu = (contact: PartyContact): MenuProps["items"] => [
        {
            key: "edit",
            label: "Edit Contact",
            icon: <EditOutlined />,
            onClick: () => openEditContact(contact),
        },
        { type: "divider" },
        {
            key: "delete",
            label: "Delete",
            icon: <DeleteOutlined className="text-red-500" />,
            danger: true,
            onClick: () => handleDeleteContact(contact.id!),
        },
    ];

    const getAddressMenu = (addr: Location): MenuProps["items"] => [
        {
            key: "edit",
            label: "Edit Address",
            icon: <EditOutlined />,
            onClick: () => openEditAddress(addr),
        },
        { type: "divider" },
        {
            key: "delete",
            label: "Delete",
            icon: <DeleteOutlined className="text-red-500" />,
            danger: true,
            onClick: () => handleDeleteAddress(addr.id!),
        },
    ];

    if (loading)
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Spin size="large" />
            </div>
        );

    if (!party)
        return (
            <div className="text-center p-12">
                <h2>Company not found</h2>
                <Button onClick={() => navigate(-1)}>
                    Go Back
                </Button>
            </div>
        );

    return (
        <div className="flex flex-col h-full max-w-[1600px] mx-auto w-full bg-gray-50/50 min-h-[calc(100vh-80px)] border-l border-t border-gray-200 relative">
            {/* --- Global Top Header --- */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center gap-5">
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(-1)}
                        className="text-gray-500 hover:bg-gray-100 flex h-10 w-10 rounded-full"
                    />
                    <div className="flex items-center gap-4">
                        <Avatar
                            size={48}
                            className="bg-blue-50 text-blue-600 border border-blue-100 font-bold text-lg rounded-xl"
                        >
                            {party.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-gray-900 m-0 tracking-tight leading-none">
                                    {party.name}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                                <Tag
                                    color={
                                        party.party_type === "supplier"
                                            ? "purple"
                                            : "blue"
                                    }
                                    className="rounded-md border-0 font-medium capitalize m-0"
                                >
                                    {party.party_type}
                                </Tag>
                                <span className="text-sm text-gray-500">
                                    {party.email || "No email"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <Dropdown
                    menu={{
                        items: [
                            {
                                key: "edit",
                                label: "Edit Main Details",
                                onClick: () => setIsEditModalOpen(true),
                            },
                            { type: "divider" },
                            {
                                key: "delete",
                                label: "Delete Company",
                                danger: true,
                                onClick: handleDeleteCompany,
                            },
                        ],
                    }}
                    trigger={["click"]}
                >
                    <Button
                        size="large"
                        icon={<MoreOutlined />}
                        className="rounded-lg shadow-sm"
                    />
                </Dropdown>
            </div>

            {/* --- Main Content Area Split --- */}
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar Navigation */}
                <div className="w-64 border-r border-gray-200 bg-white shrink-0 hidden md:flex flex-col overflow-y-auto p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-2">
                        Configuration
                    </p>
                    <nav className="space-y-1">
                        {[
                            {
                                id: "primary",
                                label: "Primary Details",
                                icon: <IdcardOutlined />,
                            },
                            {
                                id: "billing",
                                label: "Billing Addresses",
                                icon: <BankOutlined />,
                            },
                            {
                                id: "delivery",
                                label: "Delivery Locations",
                                icon: <EnvironmentOutlined />,
                            },
                            {
                                id: "opening",
                                label: "Financials & Balances",
                                icon: <WalletOutlined />,
                            },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveSection(item.id);
                                    document
                                        .getElementById(item.id)
                                        ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                        });
                                }}
                                className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeSection === item.id
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }`}
                            >
                                <span
                                    className={
                                        activeSection === item.id
                                            ? "text-blue-600"
                                            : "text-gray-400"
                                    }
                                >
                                    {item.icon}
                                </span>
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Right Scrollable Content */}
                <div className="flex-1 p-8 overflow-y-auto scroll-smooth">
                    <div className="max-w-4xl space-y-8 mx-auto pb-24">
                        {/* --- Primary Company Details --- */}
                        <section id="primary" className="scroll-mt-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h2 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
                                        <IdcardOutlined className="text-gray-400" />{" "}
                                        Primary Details
                                    </h2>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<EditOutlined />}
                                        className="text-blue-600 hover:bg-blue-50 font-medium"
                                        onClick={() => setIsEditModalOpen(true)}
                                    >
                                        Edit Main Details
                                    </Button>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8 mb-8">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">
                                                Company Reference
                                            </p>
                                            <p className="text-sm text-gray-900 font-medium m-0">
                                                {party.reference_code || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">
                                                GSTIN
                                            </p>
                                            <p className="text-sm text-gray-900 font-medium m-0">
                                                {party.gstin || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">
                                                GST Type
                                            </p>
                                            <p className="text-sm text-gray-900 font-medium m-0">
                                                {party.gst_type || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">
                                                Phone Number
                                            </p>
                                            <p className="text-sm text-gray-900 font-medium m-0">
                                                {party.phone || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">
                                                Tags
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {party.tags?.map((t) => (
                                                    <Tag
                                                        key={t.id}
                                                        color="blue"
                                                        closable
                                                        onClose={(e) => {
                                                            e.preventDefault();
                                                            handleRemoveTag(
                                                                t.id!,
                                                            );
                                                        }}
                                                        className="m-0 border-0"
                                                    >
                                                        {t.tag}
                                                    </Tag>
                                                ))}
                                                <Button
                                                    size="small"
                                                    type="dashed"
                                                    className="text-xs text-gray-500"
                                                    onClick={() =>
                                                        setIsTagModalOpen(true)
                                                    }
                                                >
                                                    <PlusOutlined /> Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contacts Sub-card */}
                                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-sm font-semibold text-gray-900 m-0">
                                                Contacts Directory
                                            </h3>
                                            <Button
                                                type="link"
                                                size="small"
                                                className="p-0 text-blue-600 font-medium"
                                                onClick={openAddContact}
                                            >
                                                <PlusOutlined /> Add Contact
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            {/* Primary Contact (From Main Record) */}
                                            <div className="flex justify-between items-center bg-white p-4 rounded border border-blue-200 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <p className="text-sm font-bold text-gray-900 m-0">
                                                            {party.contact_person ||
                                                                party.name}
                                                        </p>
                                                        <Tag
                                                            color="blue"
                                                            className="m-0 text-[10px] border-0 px-1.5 rounded"
                                                        >
                                                            Primary
                                                        </Tag>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                                        <span className="flex items-center gap-1.5">
                                                            <MailOutlined className="text-gray-400" />{" "}
                                                            {party.email || "—"}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <PhoneOutlined className="text-gray-400" />{" "}
                                                            {party.phone || "—"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="text"
                                                    icon={<EditOutlined />}
                                                    className="text-blue-500"
                                                    onClick={() =>
                                                        setIsEditModalOpen(true)
                                                    }
                                                    title="Edit Main Company"
                                                />
                                            </div>

                                            {/* Extra Contacts from DB */}
                                            {contactsList.map((contact) => (
                                                <div
                                                    key={contact.id}
                                                    className="flex justify-between items-center bg-white p-4 rounded border border-gray-200 shadow-sm hover:border-blue-300 transition-colors"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <p className="text-sm font-bold text-gray-900 m-0">
                                                                {
                                                                    contact.contact_name
                                                                }
                                                            </p>
                                                            {contact.role && (
                                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                    {
                                                                        contact.role
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                                            {contact.email && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <MailOutlined className="text-gray-400" />{" "}
                                                                    {
                                                                        contact.email
                                                                    }
                                                                </span>
                                                            )}
                                                            {contact.phone && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <PhoneOutlined className="text-gray-400" />{" "}
                                                                    {
                                                                        contact.phone
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Dropdown
                                                        menu={{
                                                            items: getContactMenu(
                                                                contact,
                                                            ),
                                                        }}
                                                        trigger={["click"]}
                                                    >
                                                        <Button
                                                            type="text"
                                                            icon={
                                                                <MoreOutlined />
                                                            }
                                                            className="text-gray-400 hover:text-gray-900"
                                                        />
                                                    </Dropdown>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* --- Billing Addresses --- */}
                        <section id="billing" className="scroll-mt-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h2 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
                                        <BankOutlined className="text-gray-400" />{" "}
                                        Billing Addresses
                                    </h2>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        className="bg-blue-600 font-medium"
                                        onClick={() =>
                                            openAddAddress("billing")
                                        }
                                    >
                                        Add Address
                                    </Button>
                                </div>
                                <div className="p-6 space-y-4">
                                    {billingAddresses.length === 0 ? (
                                        <Empty
                                            description="No billing addresses found"
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                    ) : (
                                        billingAddresses.map((addr, idx) => (
                                            <div
                                                key={addr.id || idx}
                                                className="flex justify-between items-start border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors bg-white shadow-sm"
                                            >
                                                <div className="flex gap-4">
                                                    <div className="mt-1 bg-blue-50 text-blue-600 p-2 rounded-full h-8 w-8 flex justify-center items-center shrink-0">
                                                        <BankOutlined />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 m-0 mb-1">
                                                            Billing Address{" "}
                                                            {idx + 1}
                                                        </p>
                                                        <p className="text-sm text-gray-600 m-0 leading-relaxed max-w-md mb-3">
                                                            {[
                                                                addr.address_line1,
                                                                addr.address_line2,
                                                                addr.city,
                                                                addr.state,
                                                                addr.pincode,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ")}
                                                        </p>
                                                    </div>
                                                </div>
                                                {addr.id && (
                                                    <Dropdown
                                                        menu={{
                                                            items: getAddressMenu(
                                                                addr,
                                                            ),
                                                        }}
                                                        trigger={["click"]}
                                                    >
                                                        <Button
                                                            type="text"
                                                            icon={
                                                                <MoreOutlined />
                                                            }
                                                            className="text-gray-400 hover:text-gray-900"
                                                        />
                                                    </Dropdown>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* --- Delivery Locations --- */}
                        <section id="delivery" className="scroll-mt-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h2 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
                                        <EnvironmentOutlined className="text-gray-400" />{" "}
                                        Delivery Locations
                                    </h2>
                                    <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        className="font-medium text-gray-700"
                                        onClick={() =>
                                            openAddAddress("delivery")
                                        }
                                    >
                                        Add Location
                                    </Button>
                                </div>
                                <div className="p-6 space-y-4">
                                    {deliveryLocations.length === 0 ? (
                                        <div className="p-6 flex flex-col items-center text-center">
                                            <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                                                <EnvironmentOutlined className="text-xl text-gray-300" />
                                            </div>
                                            <p className="text-sm text-gray-500 m-0 mb-4 max-w-xs">
                                                Add custom delivery addresses if
                                                goods are shipped elsewhere.
                                            </p>
                                            <Button
                                                type="dashed"
                                                icon={<PlusOutlined />}
                                                onClick={() =>
                                                    openAddAddress("delivery")
                                                }
                                            >
                                                Add Delivery Location
                                            </Button>
                                        </div>
                                    ) : (
                                        deliveryLocations.map((addr, idx) => (
                                            <div
                                                key={addr.id || idx}
                                                className="flex justify-between items-start border border-gray-200 rounded-lg p-5 bg-white shadow-sm hover:border-blue-300 transition-colors"
                                            >
                                                <div className="flex gap-4">
                                                    <div className="mt-1 bg-green-50 text-green-600 p-2 rounded-full h-8 w-8 flex justify-center items-center shrink-0">
                                                        <EnvironmentOutlined />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 m-0 mb-1">
                                                            Delivery Location{" "}
                                                            {idx + 1}
                                                        </p>
                                                        <p className="text-sm text-gray-600 m-0 leading-relaxed max-w-md">
                                                            {[
                                                                addr.address_line1,
                                                                addr.address_line2,
                                                                addr.city,
                                                                addr.state,
                                                                addr.pincode,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Dropdown
                                                    menu={{
                                                        items: getAddressMenu(
                                                            addr,
                                                        ),
                                                    }}
                                                    trigger={["click"]}
                                                >
                                                    <Button
                                                        type="text"
                                                        icon={<MoreOutlined />}
                                                        className="text-gray-400 hover:text-gray-900"
                                                    />
                                                </Dropdown>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* --- Financials & Balances Section --- */}
                        <section id="opening" className="scroll-mt-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h2 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
                                        <WalletOutlined className="text-gray-400" />{" "}
                                        Financials & Balances
                                    </h2>
                                    <Button
                                        type="link"
                                        size="small"
                                        className="font-medium text-blue-600 p-0"
                                        onClick={handleViewLedger}
                                    >
                                        View Full Ledger
                                    </Button>
                                </div>

                                <div className="p-6 grid grid-cols-2 gap-6">
                                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100 flex flex-col justify-center">
                                        <p className="text-sm font-medium text-gray-500 m-0 mb-1">
                                            Net Payables (You Owe)
                                        </p>
                                        <p className="text-2xl font-bold text-gray-900 m-0">
                                            ₹0.00
                                        </p>
                                    </div>
                                    <div className="bg-green-50/50 rounded-lg p-5 border border-green-100 flex flex-col justify-center">
                                        <p className="text-sm font-medium text-green-700 m-0 mb-1">
                                            Net Receivables (They Owe)
                                        </p>
                                        <p className="text-2xl font-bold text-green-800 m-0">
                                            ₹0.00
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* Floating Help Button */}
            <div className="fixed bottom-8 right-8 z-50">
                <Button
                    type="primary"
                    shape="round"
                    icon={<QuestionCircleOutlined />}
                    size="large"
                    className="bg-gray-800 hover:bg-gray-900 border-none shadow-lg px-6 font-medium tracking-wide h-12"
                    onClick={() => {
                        Modal.info({
                            title: "Help & Support",
                            content:
                                "For assistance, please email support@quadstack.com or call +1-800-QUADSTACK.",
                            centered: true,
                            okText: "Got it",
                        });
                    }}
                >
                    Help & Support
                </Button>
            </div>

            {/* ========================================== */}
            {/* ================ MODALS ================== */}
            {/* ========================================== */}

            <Modal
                title="Edit Main Company Details"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                onOk={() => editForm.submit()}
                okText="Save Changes"
                destroyOnHidden
                width={700}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleUpdateCompany}
                    className="mt-4"
                >
                    <div className="grid grid-cols-2 gap-x-4">
                        <Form.Item
                            name="name"
                            label="Company Name"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="reference_code" label="Reference Code">
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="email"
                            label="Main Email"
                            rules={[{ type: "email" }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="phone" label="Main Phone">
                            <Input />
                        </Form.Item>
                        <Form.Item name="gstin" label="GSTIN">
                            <Input />
                        </Form.Item>
                        <Form.Item name="gst_type" label="GST Type">
                            <Select
                                options={[
                                    { label: "Regular", value: "Regular" },
                                    {
                                        label: "Unregistered",
                                        value: "Unregistered",
                                    },
                                ]}
                            />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            <Modal
                title="Add Tag"
                open={isTagModalOpen}
                onCancel={() => setIsTagModalOpen(false)}
                onOk={() => tagForm.submit()}
                okText="Add Tag"
                destroyOnHidden
            >
                <Form
                    form={tagForm}
                    layout="vertical"
                    onFinish={handleAddTag}
                    className="mt-4"
                >
                    <Form.Item
                        name="tag"
                        label="Tag Name"
                        rules={[{ required: true }]}
                    >
                        <Input placeholder="e.g. VIP Customer" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingContactId ? "Edit Contact" : "Add Contact"}
                open={isContactModalOpen}
                onCancel={() => setIsContactModalOpen(false)}
                onOk={() => contactForm.submit()}
                okText="Save Contact"
                destroyOnHidden
            >
                <Form
                    form={contactForm}
                    layout="vertical"
                    onFinish={handleSaveContact}
                    className="mt-4"
                >
                    <Form.Item
                        name="contact_name"
                        label="Contact Name"
                        rules={[{ required: true }]}
                    >
                        <Input placeholder="John Doe" />
                    </Form.Item>
                    <Form.Item
                        name="email"
                        label="Email Address"
                        rules={[{ type: "email" }]}
                    >
                        <Input placeholder="john@example.com" />
                    </Form.Item>
                    <Form.Item name="phone" label="Phone Number">
                        <Input placeholder="+1 234 567 8900" />
                    </Form.Item>
                    <Form.Item name="role" label="Role / Designation">
                        <Input placeholder="e.g. Procurement Manager" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingAddressId ? "Edit Address" : "Add Address"}
                open={isAddressModalOpen}
                onCancel={() => setIsAddressModalOpen(false)}
                onOk={() => addressForm.submit()}
                okText="Save Address"
                destroyOnHidden
                width={600}
            >
                <Form
                    form={addressForm}
                    layout="vertical"
                    onFinish={handleSaveAddress}
                    className="mt-4"
                >
                    <Form.Item name="location_type" label="Address Type">
                        <Select
                            options={[
                                { label: "Billing Address", value: "billing" },
                                {
                                    label: "Delivery / Shipping Location",
                                    value: "delivery",
                                },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item
                        name="address_line1"
                        label="Street Address Line 1"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item name="address_line2" label="Street Address Line 2">
                        <Input />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-x-4">
                        <Form.Item
                            name="city"
                            label="City"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="state" label="State">
                            <Input />
                        </Form.Item>
                        <Form.Item name="pincode" label="Pincode/ZIP">
                            <Input />
                        </Form.Item>
                        <Form.Item name="country" label="Country">
                            <Input />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
