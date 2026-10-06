import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Typography, List } from 'antd';
import { message } from '@/lib/antdHelper';
import { PlusOutlined, EditOutlined, SearchOutlined, LeftOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import AddressFormDrawer from '@/features/purchases/components/drawers/AddressFormDrawer';

const { Text } = Typography;

export interface DeliveryLocationData {
  companyName?: string;
  locationName?: string;
  gstin?: string;
  address?: string;
  address1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
  billingLocations?: any[];
}

interface DeliveryLocationDataDrawerProps {
  open: boolean;
  onClose: () => void;
  deliveryLocation: DeliveryLocationData;
  onSave: (deliveryLocation: DeliveryLocationData) => void;
}

export default function DeliveryLocationDataDrawer({ open, onClose, deliveryLocation, onSave }: DeliveryLocationDataDrawerProps) {
  const [form] = Form.useForm();
  const [billingLocations, setBillingLocations] = useState<any[]>(deliveryLocation.billingLocations || []);
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      form.setFieldsValue(deliveryLocation);
      setBillingLocations(deliveryLocation.billingLocations || []);
    }
  }, [open, deliveryLocation, form]);

  // Persist locations to parent (and thus localStorage) whenever they change
  const persistLocations = (newLocations: any[]) => {
    setBillingLocations(newLocations);
    onSave({ ...deliveryLocation, billingLocations: newLocations });
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      onSave({ ...deliveryLocation, ...values, billingLocations });
      onClose();
    });
  };

  const handleSaveLocation = (location: any) => {
    let newLocations: any[];
    if (editingLocation) {
      newLocations = billingLocations.map(l => l.id === editingLocation.id ? { ...location, id: l.id } : l);
    } else {
      newLocations = [...billingLocations, { ...location, id: Date.now() }];
    }
    persistLocations(newLocations);
    message.success(editingLocation ? 'Location updated' : 'Location added successfully');
  };

  const openAddLocation = () => {
    setEditingLocation(null);
    setIsLocationDrawerOpen(true);
  };

  const openEditLocation = (loc: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLocation(loc);
    setIsLocationDrawerOpen(true);
  };

  const handleDeleteLocation = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newLocations = billingLocations.filter(l => l.id !== id);
    persistLocations(newLocations);
    message.success('Location deleted');
  };

  const handleSelectLocation = (loc: any) => {
    onSave({
      ...deliveryLocation,
      locationName: loc.locationName || loc.companyName || deliveryLocation.locationName,
      companyName: loc.locationName || loc.companyName,
      gstin: loc.gstin || '',
      address: loc.address1 || loc.address || '',
      address1: loc.address1 || loc.address || '',
      city: loc.city || '',
      state: loc.state || '',
      pincode: loc.pin || loc.pincode || '',
      country: loc.country || 'India',
      contactPerson: loc.contactPerson || '',
      phone: loc.phone || '',
      billingLocations
    });
    message.success(`Location "${loc.locationName || 'Main'}" selected as Delivery Location`);
    onClose();
  };

  const filteredLocations = searchQuery
    ? billingLocations.filter(loc =>
        (loc.locationName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.address1 || loc.address || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : billingLocations;

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <LeftOutlined onClick={onClose} className="cursor-pointer" />
              <span>Delivery Location Details</span>
            </div>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddLocation} style={{ background: '#1677ff', borderColor: '#1677ff' }}>
              Add Location
            </Button>
          </div>
        }
        closable={false}
        width={450}
        onCancel={onClose}
        open={open}
        className="delivery-location-modal"
        footer={null}
        styles={{ body: { padding: 0 } }}
      >
        {/* Edit Delivery Location Form */}
        <div className="p-5 bg-white border-b border-gray-100 mb-2">
          <Text strong className="block mb-4 text-[#0fa387] text-sm uppercase tracking-wider">Edit Delivery Location</Text>
          <Form form={form} layout="vertical" size="middle">
            <Form.Item name="companyName" label={<span className="text-gray-500 font-medium text-xs">Company Name</span>} style={{ marginBottom: 16 }}>
              <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
            <Form.Item name="gstin" label={<span className="text-gray-500 font-medium text-xs">GSTIN</span>} style={{ marginBottom: 16 }}>
              <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
            <Form.Item name="address" label={<span className="text-gray-500 font-medium text-xs">Address</span>} style={{ marginBottom: 16 }}>
              <Input.TextArea rows={2} className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
            </Form.Item>
            <div className="flex gap-4">
              <Form.Item name="city" label={<span className="text-gray-500 font-medium text-xs">City</span>} className="flex-1" style={{ marginBottom: 16 }}>
                <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
              </Form.Item>
              <Form.Item name="state" label={<span className="text-gray-500 font-medium text-xs">State</span>} className="flex-1" style={{ marginBottom: 16 }}>
                <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
              </Form.Item>
              <Form.Item name="pincode" label={<span className="text-gray-500 font-medium text-xs">Pincode</span>} className="flex-1" style={{ marginBottom: 16 }}>
                <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
              </Form.Item>
            </div>
            <div className="flex gap-4">
              <Form.Item name="contactPerson" label={<span className="text-gray-500 font-medium text-xs">Contact Person</span>} className="flex-1" style={{ marginBottom: 16 }}>
                <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
              </Form.Item>
              <Form.Item name="phone" label={<span className="text-gray-500 font-medium text-xs">Phone</span>} className="flex-1" style={{ marginBottom: 16 }}>
                <Input className="rounded-md border-gray-300 hover:border-[#0fa387] focus:border-[#0fa387]" />
              </Form.Item>
            </div>
            <div className="flex justify-end mt-4">
              <Button type="primary" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 border-none px-6 font-medium rounded-md shadow-sm">
                Update Location
              </Button>
            </div>
          </Form>
        </div>

        {/* Locations List */}
        <div className="p-5 bg-gray-50 flex-1">
          <div className="flex justify-between items-center mb-4">
              <Text strong className="text-[#0fa387] text-sm uppercase tracking-wider">Delivery Locations ({billingLocations.length})</Text>
          </div>
          <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="Search locations..." className="mb-4 bg-white border-gray-200 rounded-md" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear />
          
          {filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Text type="secondary">No locations added yet. Click "Add Location" to add one.</Text>
            </div>
          ) : (
            <List
              dataSource={filteredLocations}
              renderItem={(loc) => (
                <div 
                  className="py-3 border-b border-gray-100 flex justify-between items-start hover:bg-blue-50 px-3 rounded -mx-2 cursor-pointer transition-all duration-200"
                  onClick={() => handleSelectLocation(loc)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Text strong className="text-sm">{loc.locationName || 'Main'}</Text>
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    </div>
                    <Text type="secondary" className="text-xs">{loc.address1 || loc.address}, {loc.city} ({loc.state})</Text><br />
                    <Text type="secondary" className="text-xs">{loc.country || 'India'} - {loc.pin || loc.pincode}</Text>
                    {loc.gstin && <><br /><Text type="secondary" className="text-xs">GSTIN: {loc.gstin}</Text></>}
                  </div>
                  <div className="flex gap-1 bg-white p-1 rounded-md shadow-sm border border-gray-100">
                    <Button type="text" size="small" icon={<EditOutlined className="text-gray-500 hover:text-blue-500" />} onClick={(e) => openEditLocation(loc, e)} />
                    <Button type="text" size="small" danger icon={<DeleteOutlined className="text-gray-500 hover:text-red-500" />} onClick={(e) => handleDeleteLocation(loc.id, e)} />
                  </div>
                </div>
              )}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            />
          )}
        </div>

        <style>{`
          .delivery-location-modal .ant-modal-content { padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
          .delivery-location-modal .ant-modal-header { background-color: #ffffff; border-bottom: 1px solid rgba(0,0,0,0.05); padding: 16px 20px; margin: 0; border-radius: 12px 12px 0 0; }
          .delivery-location-modal .ant-modal-title { color: #1f2937; font-weight: 500; }
          .delivery-location-modal .ant-form-item-label { padding-bottom: 4px; }
          .delivery-location-modal .ant-list-items > div:last-child { border-bottom: none !important; }
        `}</style>
      </Modal>

      <AddressFormDrawer
        open={isLocationDrawerOpen}
        onClose={() => setIsLocationDrawerOpen(false)}
        initialData={editingLocation}
        onSave={handleSaveLocation}
      />
    </>
  );
}
