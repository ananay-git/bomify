import { useEffect } from 'react';
import { Modal, Form, Input, Button, Select, Row, Col } from 'antd';
import { LeftOutlined } from '@ant-design/icons';

const { Option } = Select;

interface UserAddressDrawerProps {
  open: boolean;
  onClose: () => void;
  addressData: any;
  onSave: (data: any) => void;
}

export default function UserAddressDrawer({ open, onClose, addressData, onSave }: UserAddressDrawerProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(addressData);
    }
  }, [open, addressData, form]);

  const handleSave = () => {
    form.validateFields().then(values => {
      onSave(values);
      onClose();
    });
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <LeftOutlined onClick={onClose} className="cursor-pointer" />
          <span>Edit Default Address</span>
        </div>
      }
      closable={false}
      width={400}
      onCancel={onClose}
      open={open}
      className="user-address-modal"
      footer={
        <div className="flex justify-end p-2 px-4 shadow-inner border-t">
          <Button type="primary" onClick={handleSave} className="bg-green-500 hover:bg-green-600 border-none w-24">
            SAVE
          </Button>
        </div>
      }
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Form form={form} layout="vertical" size="middle">
        <Form.Item name="address1" label={<span className="text-gray-500 font-medium text-xs">Address Line 1 <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
          <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
        </Form.Item>
        <Form.Item name="address2" label={<span className="text-gray-500 font-medium text-xs">Address Line 2 <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
          <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="pincode" label={<span className="text-gray-500 font-medium text-xs">Pincode</span>} style={{ marginBottom: 16 }}>
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
            <Form.Item name="country" label={<span className="text-gray-500 font-medium text-xs">Country</span>} style={{ marginBottom: 16 }}>
              <Select className="w-full">
                <Option value="India">India</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="state" label={<span className="text-gray-500 font-medium text-xs">State</span>} style={{ marginBottom: 16 }}>
              <Select className="w-full">
                <Option value="Maharashtra">Maharashtra</Option>
                <Option value="Gujarat">Gujarat</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <style>{`
        .user-address-modal .ant-modal-content {
          padding: 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .user-address-modal .ant-modal-header {
          background-color: #ffffff;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding: 16px 20px;
          margin: 0;
          border-radius: 12px 12px 0 0;
        }
        .user-address-modal .ant-modal-title {
          color: #1f2937;
          font-weight: 500;
        }
        .user-address-modal .ant-form-item-label {
          padding-bottom: 4px;
        }
      `}</style>
    </Modal>
  );
}
