import { useEffect } from 'react';
import { Modal, Form, Input, Button, Select, Checkbox, Row, Col } from 'antd';
import { LeftOutlined } from '@ant-design/icons';

const { Option } = Select;

interface AddressFormDrawerProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: (location: any) => void;
}

export default function AddressFormDrawer({ open, onClose, initialData, onSave }: AddressFormDrawerProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue(initialData);
      } else {
        form.resetFields();
        form.setFieldsValue({ country: 'India', state: 'Maharashtra', gstinType: 'Regular' });
      }
    }
  }, [open, initialData, form]);

  const handleSave = () => {
    form.validateFields().then(values => {
      onSave(values);
      onClose();
    });
  };

  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <LeftOutlined onClick={onClose} className="cursor-pointer" />
            <span>Billing Location Details</span>
          </div>
        </div>
      }
      closable={false}
      width={500}
      onCancel={onClose}
      open={open}
      className="billing-location-form-modal"
      footer={
        <div className="flex justify-end p-2 px-4 shadow-inner border-t">
          <Button type="primary" onClick={handleSave} className="bg-green-500 hover:bg-green-600 border-none w-24">
            SAVE
          </Button>
        </div>
      }
      styles={{ body: { padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-6 pb-2">Company Details</div>
      <Form form={form} layout="vertical" size="middle">
        <Form.Item name="locationName" label={<span className="text-gray-500 font-medium text-xs">Location Name <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
          <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="gstinType" label={<span className="text-gray-500 font-medium text-xs">GSTIN Type</span>} style={{ marginBottom: 16 }}>
              <Select className="w-full">
                <Option value="Regular">Regular</Option>
                <Option value="Composition">Composition</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="gstin" label={<span className="text-gray-500 font-medium text-xs">GSTIN</span>} style={{ marginBottom: 16 }}>
              <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address1" label={<span className="text-gray-500 font-medium text-xs">Address Line 1 <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
          <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
        </Form.Item>
        <Form.Item name="address2" label={<span className="text-gray-500 font-medium text-xs">Address Line 2</span>} style={{ marginBottom: 16 }}>
          <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="pin" label={<span className="text-gray-500 font-medium text-xs">Pincode <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
              <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="city" label={<span className="text-gray-500 font-medium text-xs">City</span>} style={{ marginBottom: 16 }}>
              <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="state" label={<span className="text-gray-500 font-medium text-xs">State <span className="text-red-500">*</span></span>} style={{ marginBottom: 16 }}>
              <Select className="w-full">
                <Option value="Maharashtra">Maharashtra</Option>
                <Option value="Gujarat">Gujarat</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="country" label={<span className="text-gray-500 font-medium text-xs">Country <span className="text-red-500">*</span></span>} style={{ marginBottom: 16 }}>
              <Select className="w-full">
                <Option value="India">India</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 mt-2 mb-4">
          <Form.Item name="isDelivery" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Checkbox className="text-blue-600 font-medium text-sm">Also mark this address as a Delivery Location</Checkbox>
          </Form.Item>
          <Form.Item name="deliveryLocationName" label={<span className="text-gray-500 font-medium text-xs">Delivery Location Name</span>} style={{ marginBottom: 0 }}>
            <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" placeholder="E.g. Main Warehouse" />
          </Form.Item>
        </div>
      </Form>

      <style>{`
        .billing-location-form-modal .ant-modal-content {
          padding: 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .billing-location-form-modal .ant-modal-header {
          background-color: #ffffff;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding: 16px 20px;
          margin: 0;
          border-radius: 12px 12px 0 0;
        }
        .billing-location-form-modal .ant-modal-title {
          color: #1f2937;
          font-weight: 500;
        }
        .billing-location-form-modal .ant-form-item-label {
          padding-bottom: 4px;
        }
      `}</style>
    </Modal>
  );
}
