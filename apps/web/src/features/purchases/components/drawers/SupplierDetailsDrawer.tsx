import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Typography, List, Spin } from 'antd';
import { message } from '@/lib/antdHelper';
import { PlusOutlined, EditOutlined, SearchOutlined, LeftOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import AddressFormDrawer from '@/features/purchases/components/drawers/AddressFormDrawer';
import { fetchPartyLocations, addPartyLocation, updatePartyLocation, deletePartyLocation, Location } from '@/features/parties/api/parties';

const { Text } = Typography;

export interface SupplierDetails {
  id?: number;
  companyName?: string;
  name?: string;
  gstin?: string | null;
  address?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  contactPerson?: string;
  contact_person?: string | null;
  phone?: string | null;
  billingLocations?: any[];
}

interface SupplierDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  supplier: SupplierDetails;
  onSave: (supplier: SupplierDetails) => void;
}

export default function SupplierDetailsDrawer({ open, onClose, supplier, onSave }: SupplierDetailsDrawerProps) {
  const [form] = Form.useForm();
  const [billingLocations, setBillingLocations] = useState<any[]>([]);
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const supplierId = supplier?.id;

  // Fetch locations from backend when drawer opens
  useEffect(() => {
    if (open && supplierId) {
      setLoadingLocations(true);
      fetchPartyLocations(supplierId)
        .then((locs) => {
          setBillingLocations(locs);
        })
        .catch((err) => {
          console.error('Failed to fetch supplier locations', err);
          setBillingLocations(supplier.billingLocations || []);
        })
        .finally(() => setLoadingLocations(false));
    }
    if (open) {
      form.setFieldsValue({
        companyName: supplier.companyName || supplier.name || '',
        gstin: supplier.gstin || '',
        address: supplier.address || supplier.address1 || '',
        city: supplier.city || '',
        state: supplier.state || '',
        pincode: supplier.pincode || '',
        contactPerson: supplier.contactPerson || supplier.contact_person || '',
        phone: supplier.phone || '',
      });
    }
  }, [open, supplierId]);

  const handleSave = () => {
    form.validateFields().then(values => {
      onSave({ ...supplier, ...values, billingLocations });
      onClose();
    });
  };

  const handleSaveLocation = async (locationData: any) => {
    if (!supplierId) {
      let newLocations: any[];
      if (editingLocation) {
        newLocations = billingLocations.map(l => l.id === editingLocation.id ? { ...locationData, id: l.id } : l);
      } else {
        newLocations = [...billingLocations, { ...locationData, id: Date.now() }];
      }
      setBillingLocations(newLocations);
      message.success(editingLocation ? 'Location updated' : 'Location added successfully');
      return;
    }

    try {
      const payload: Location = {
        location_type: locationData.location_type || 'billing',
        address_line1: locationData.address_line1 || locationData.address1 || locationData.address || '',
        address_line2: locationData.address_line2 || locationData.address2 || '',
        city: locationData.city || '',
        state: locationData.state || '',
        pincode: locationData.pincode || locationData.pin || '',
        country: locationData.country || 'India',
        gstin: locationData.gstin || '',
        is_default: locationData.is_default || false,
      };

      if (editingLocation && editingLocation.id) {
        await updatePartyLocation(supplierId, editingLocation.id, payload);
        message.success('Location updated successfully');
      } else {
        await addPartyLocation(supplierId, payload);
        message.success('Location added successfully');
      }

      const updated = await fetchPartyLocations(supplierId);
      setBillingLocations(updated);
    } catch (err) {
      console.error('Failed to save location', err);
      message.error('Failed to save location');
    }
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

  const handleDeleteLocation = async (locId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supplierId) {
      setBillingLocations(billingLocations.filter(l => l.id !== locId));
      message.success('Location deleted');
      return;
    }
    try {
      await deletePartyLocation(supplierId, locId);
      message.success('Location deleted');
      const updated = await fetchPartyLocations(supplierId);
      setBillingLocations(updated);
    } catch (err) {
      console.error('Failed to delete location', err);
      message.error('Failed to delete location');
    }
  };

  const handleSelectLocation = (loc: any) => {
    onSave({
      ...supplier,
      companyName: loc.locationName || loc.address_line1 || supplier.companyName || supplier.name,
      gstin: loc.gstin || supplier.gstin || '',
      address: loc.address_line1 || loc.address1 || loc.address || '',
      address1: loc.address_line1 || loc.address1 || '',
      city: loc.city || '',
      state: loc.state || '',
      pincode: loc.pincode || loc.pin || '',
      country: loc.country || 'India',
      billingLocations
    });
    message.success(`Location selected as Supplier address`);
    onClose();
  };

  const filteredLocations = searchQuery
    ? billingLocations.filter(loc =>
        (loc.address_line1 || loc.locationName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.gstin || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : billingLocations;

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <LeftOutlined onClick={onClose} className="cursor-pointer" />
              <span>Supplier Location Details</span>
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
        className="supplier-details-modal"
        footer={null}
        styles={{ body: { padding: 0 } }}
      >
        {/* Edit Supplier Details Form */}
        <div className="p-5 bg-white border-b border-gray-100 mb-2">
          <Text strong className="block mb-4 text-[#0fa387] text-sm uppercase tracking-wider">Edit Supplier Details</Text>
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
                Update Supplier
              </Button>
            </div>
          </Form>
        </div>

        {/* Locations List */}
        <div className="p-5 bg-gray-50 flex-1">
          <div className="flex justify-between items-center mb-4">
              <Text strong className="text-[#0fa387] text-sm uppercase tracking-wider">Billing Locations ({billingLocations.length})</Text>
          </div>
          <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="Search locations..." className="mb-4 bg-white border-gray-200 rounded-md" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear />
          
          {loadingLocations ? (
            <div className="text-center py-8"><Spin /></div>
          ) : filteredLocations.length === 0 ? (
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
                      <Text strong className="text-sm">{loc.address_line1 || loc.locationName || 'Main'}</Text>
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    </div>
                    <Text type="secondary" className="text-xs">{loc.address_line1 || loc.address1 || loc.address}, {loc.city} ({loc.state})</Text><br />
                    <Text type="secondary" className="text-xs">{loc.country || 'India'} - {loc.pincode || loc.pin}</Text>
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
          .supplier-details-modal .ant-modal-content { padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
          .supplier-details-modal .ant-modal-header { background-color: #ffffff; border-bottom: 1px solid rgba(0,0,0,0.05); padding: 16px 20px; margin: 0; border-radius: 12px 12px 0 0; }
          .supplier-details-modal .ant-modal-title { color: #1f2937; font-weight: 500; }
          .supplier-details-modal .ant-form-item-label { padding-bottom: 4px; }
          .supplier-details-modal .ant-list-items > div:last-child { border-bottom: none !important; }
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
