import { Form, Input, Select, Radio, Button } from 'antd';
import { message } from '@/lib/antdHelper';
import { useEffect } from "react";
import {
    UserOutlined,
    ShopOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import {
    createParty,
    CreatePartyPayload,
} from "@/features/parties/api/parties";
import { extractApiError } from "@/lib/errors";

interface AddCompanyFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialType?: string; // Relaxed type to handle both frontend/backend strings
}

export default function AddCompanyForm({
    onSuccess,
    onCancel,
    initialType = "supplier",
}: AddCompanyFormProps) {
    const [form] = Form.useForm();

    // Map the incoming prop to the backend's PartyType enum values.
    // Backend supports: "customer", "supplier", "both", "buyer" as distinct types.
    const mapInitialType = (type?: string) => {
        if (type === "buyer") return "buyer";
        if (type === "customer") return "customer";
        if (type === "both") return "both";
        return "supplier"; // default
    };

    const safeInitialType = mapInitialType(initialType);

    // Reset form and set initial values when modal opens
    useEffect(() => {
        form.setFieldsValue({ party_type: safeInitialType });
    }, [form, safeInitialType]);

    const onFinish = async (values: any) => {
        try {
            // values.party_type will now precisely equal "customer", "supplier", or "both"
            // based strictly on what the user clicked in the Radio group.
            await createParty(values as CreatePartyPayload);
            message.success("Company created successfully");
            form.resetFields();
            onSuccess();
        } catch (err) {
            message.error(extractApiError(err, "Failed to create company"));
        }
    };

    const labelStyle =
        "text-[12px] font-semibold text-gray-500 uppercase tracking-tight mb-1 inline-block";

    return (
        <>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .custom-radio-group .ant-radio-button-wrapper {
                    margin-inline-start: 8px !important;
                    border-inline-start-width: 1px !important;
                    border-radius: 6px !important;
                }
                .custom-radio-group .ant-radio-button-wrapper:first-child {
                    margin-inline-start: 0 !important;
                }
                .custom-radio-group .ant-radio-button-wrapper:before {
                    display: none !important;
                }
            `,
                }}
            />

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                initialValues={{
                    party_type: safeInitialType,
                    country: "India",
                    gst_type: "Regular",
                }}
                className="flex flex-col h-full"
            >
                <div className="px-8 py-5 space-y-6 max-h-[60vh] overflow-y-auto bg-white">
                    {/* SECTION 1: CONTACT */}
                    <section className="relative pl-6 border-l border-blue-100">
                        <div className="absolute -left-1.5 top-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <div className="flex items-center gap-2 mb-3">
                            <UserOutlined className="text-blue-500 text-sm" />
                            <h3 className="text-md font-bold text-gray-800 m-0">
                                Primary Contact
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Form.Item
                                name="contact_person"
                                label={
                                    <span className={labelStyle}>
                                        Full Name
                                    </span>
                                }
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input
                                    size="large"
                                    placeholder="Alex Johnson"
                                />
                            </Form.Item>
                            <Form.Item
                                name="email"
                                label={
                                    <span className={labelStyle}>Email</span>
                                }
                                rules={[{ required: true, type: "email" }]}
                                className="mb-0"
                            >
                                <Input
                                    size="large"
                                    placeholder="alex@company.com"
                                />
                            </Form.Item>
                            <Form.Item
                                name="phone"
                                label={
                                    <span className={labelStyle}>
                                        Mobile No.
                                    </span>
                                }
                                className="mb-0"
                            >
                                <Input size="large" placeholder="+91..." />
                            </Form.Item>
                        </div>
                    </section>

                    {/* SECTION 2: COMPANY DETAILS */}
                    <section className="relative pl-6 border-l border-blue-100">
                        <div className="absolute -left-1.5 top-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <ShopOutlined className="text-blue-500 text-sm" />
                                <h3 className="text-md font-bold text-gray-800 m-0">
                                    Company Details
                                </h3>
                            </div>

                            <Form.Item name="party_type" className="m-0">
                                <Radio.Group
                                    buttonStyle="solid"
                                    className="custom-radio-group flex p-1 bg-gray-50 rounded-lg border border-gray-100"
                                >
                                    {/* The value sent to the DB matches the backend PartyType enum exactly */}
                                    <Radio.Button value="customer">
                                        Buyer
                                    </Radio.Button>
                                    <Radio.Button value="supplier">
                                        Supplier
                                    </Radio.Button>
                                    <Radio.Button value="both">
                                        Both
                                    </Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                            <Form.Item
                                name="name"
                                label={
                                    <span className={labelStyle}>
                                        Company Name
                                    </span>
                                }
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="email_company"
                                label={
                                    <span className={labelStyle}>
                                        Accounts Email
                                    </span>
                                }
                                rules={[{ required: true, type: "email" }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="gstin"
                                label={
                                    <span className={labelStyle}>GSTIN</span>
                                }
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="gst_type"
                                label={
                                    <span className={labelStyle}>
                                        Tax Category
                                    </span>
                                }
                                className="mb-0"
                            >
                                <Select
                                    size="large"
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
                    </section>

                    {/* SECTION 3: LOCATION */}
                    <section className="relative pl-6 border-l border-blue-100">
                        <div className="absolute -left-1.5 top-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <div className="flex items-center gap-2 mb-3">
                            <EnvironmentOutlined className="text-blue-500 text-sm" />
                            <h3 className="text-md font-bold text-gray-800 m-0">
                                Office Address
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                            <Form.Item
                                name="address1"
                                label={
                                    <span className={labelStyle}>
                                        Street Address
                                    </span>
                                }
                                rules={[{ required: true }]}
                                className="col-span-2 mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="city"
                                label={<span className={labelStyle}>City</span>}
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="state"
                                label={
                                    <span className={labelStyle}>State</span>
                                }
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="pincode"
                                label={
                                    <span className={labelStyle}>Pincode</span>
                                }
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                            <Form.Item
                                name="country"
                                label={
                                    <span className={labelStyle}>Country</span>
                                }
                                rules={[{ required: true }]}
                                className="mb-0"
                            >
                                <Input size="large" />
                            </Form.Item>
                        </div>
                    </section>
                </div>

                <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-3">
                    <Button
                        type="text"
                        onClick={onCancel}
                        className="text-gray-500 font-medium"
                    >
                        Discard
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        className="bg-blue-600 h-10 px-8 rounded-lg font-bold border-none"
                    >
                        Create Company
                    </Button>
                </div>
            </Form>
        </>
    );
}
