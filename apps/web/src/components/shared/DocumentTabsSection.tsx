/**
 * DocumentTabsSection — Reusable tabs for Extra Charges, Attachments,
 * Terms & Conditions, Notes, Additional Details, Comments, and Signature.
 *
 * Used in Sales Order and Purchase Order create/detail pages.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, Input, Button, Typography, Space, InputNumber, Select, Upload, Tag, Tooltip, Popconfirm, Empty } from 'antd';
import {
    PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined,
    FileOutlined, FilePdfOutlined, FileImageOutlined, FileExcelOutlined,
    ClearOutlined, EditOutlined, UserOutlined, ClockCircleOutlined,
    InboxOutlined, CheckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

// ─── Types ─────────────────────────────────────────────────────

export interface ExtraCharge {
    id: string;
    description: string;
    amount: number;
    tax_rate: number;
}

export interface AttachmentFile {
    id: string;
    name: string;
    type: string;
    size: number;
    data_base64: string;
    uploaded_at: string;
}

export interface Comment {
    id: string;
    author: string;
    text: string;
    created_at: string;
}

export interface AdditionalDetail {
    id: string;
    key: string;
    value: string;
}

export interface SignatureData {
    image_base64: string | null;
    signer_name: string;
    signed_at: string | null;
}

export interface DocumentTabsData {
    extra_charges: ExtraCharge[];
    attachments: AttachmentFile[];
    terms_conditions: string;
    notes: string;
    comments: Comment[];
    additional_details: AdditionalDetail[];
    signature_data: SignatureData | null;
}

export const EMPTY_TABS_DATA: DocumentTabsData = {
    extra_charges: [],
    attachments: [],
    terms_conditions: '',
    notes: '',
    comments: [],
    additional_details: [],
    signature_data: null,
};

interface Props {
    mode: 'create' | 'view' | 'edit';
    value: DocumentTabsData;
    onChange: (data: DocumentTabsData) => void;
    currentUser?: string;
}

const DEFAULT_TERMS = `1. Goods once sold will not be taken back or exchanged.
2. All disputes are subject to local jurisdiction only.
3. This is a computer-generated document and does not require a physical signature.
4. Payment should be made within the agreed payment terms.
5. Any delay in payment may attract interest as per agreed terms.`;

// ─── Helpers ───────────────────────────────────────────────────

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function getFileIcon(type: string) {
    if (type.includes('pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
    if (type.includes('image')) return <FileImageOutlined style={{ color: '#1677ff', fontSize: 20 }} />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
    return <FileOutlined style={{ color: '#8c8c8c', fontSize: 20 }} />;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Component ─────────────────────────────────────────────────

export default function DocumentTabsSection({ mode, value, onChange, currentUser }: Props) {
    const isReadOnly = mode === 'view';

    const update = useCallback((partial: Partial<DocumentTabsData>) => {
        onChange({ ...value, ...partial });
    }, [value, onChange]);

    // ── Extra Charges Tab ──

    const chargesTotal = value.extra_charges.reduce((s, c) => {
        const net = c.amount + c.amount * (c.tax_rate / 100);
        return s + net;
    }, 0);

    const extraChargesTabContent = (
        <div style={{ padding: 16 }}>
            {!isReadOnly && (
                <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => update({
                        extra_charges: [...value.extra_charges, { id: uid(), description: '', amount: 0, tax_rate: 0 }]
                    })}
                    style={{ marginBottom: 12, borderColor: '#1677ff', color: '#1677ff' }}
                >
                    Add Charge
                </Button>
            )}
            {value.extra_charges.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>No extra charges applied yet.</Text>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, padding: '0 4px' }}>
                        <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Description</Text>
                        <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Amount (₹)</Text>
                        <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Tax %</Text>
                        <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Total</Text>
                        <div style={{ width: 32 }} />
                    </div>
                    {value.extra_charges.map(charge => {
                        const total = charge.amount + charge.amount * (charge.tax_rate / 100);
                        return (
                            <div key={charge.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                {isReadOnly ? (
                                    <Text style={{ fontSize: 13 }}>{charge.description || '-'}</Text>
                                ) : (
                                    <Input
                                        size="small"
                                        value={charge.description}
                                        onChange={e => update({
                                            extra_charges: value.extra_charges.map(c => c.id === charge.id ? { ...c, description: e.target.value } : c)
                                        })}
                                        placeholder="e.g. Freight, Packaging"
                                        style={{ borderRadius: 6 }}
                                    />
                                )}
                                {isReadOnly ? (
                                    <Text style={{ fontSize: 13 }}>{formatCurrency(charge.amount)}</Text>
                                ) : (
                                    <InputNumber
                                        size="small" min={0} step={0.01} value={charge.amount}
                                        onChange={val => update({
                                            extra_charges: value.extra_charges.map(c => c.id === charge.id ? { ...c, amount: val || 0 } : c)
                                        })}
                                        prefix="₹" style={{ width: '100%', borderRadius: 6 }}
                                    />
                                )}
                                {isReadOnly ? (
                                    <Text style={{ fontSize: 13 }}>{charge.tax_rate}%</Text>
                                ) : (
                                    <Select
                                        size="small" value={charge.tax_rate}
                                        onChange={val => update({
                                            extra_charges: value.extra_charges.map(c => c.id === charge.id ? { ...c, tax_rate: val } : c)
                                        })}
                                        options={[{ value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 12, label: '12%' }, { value: 18, label: '18%' }, { value: 28, label: '28%' }]}
                                        style={{ width: '100%' }}
                                    />
                                )}
                                <Text strong style={{ fontSize: 13, color: '#0f766e' }}>{formatCurrency(total)}</Text>
                                {!isReadOnly && (
                                    <Button type="text" danger icon={<DeleteOutlined />} size="small"
                                        onClick={() => update({ extra_charges: value.extra_charges.filter(c => c.id !== charge.id) })}
                                    />
                                )}
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #e5e7eb', marginTop: 8 }}>
                        <Text strong style={{ fontSize: 13, color: '#0f766e' }}>Charges Total: {formatCurrency(chargesTotal)}</Text>
                    </div>
                </>
            )}
        </div>
    );

    // ── Attachments Tab ──

    const handleFileUpload = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            return false; // skip files > 5MB
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            const newAttachment: AttachmentFile = {
                id: uid(),
                name: file.name,
                type: file.type,
                size: file.size,
                data_base64: base64,
                uploaded_at: new Date().toISOString(),
            };
            update({ attachments: [...value.attachments, newAttachment] });
        };
        reader.readAsDataURL(file);
        return false; // prevent default upload
    };

    const handleDownloadAttachment = (att: AttachmentFile) => {
        const link = document.createElement('a');
        link.href = `data:${att.type};base64,${att.data_base64}`;
        link.download = att.name;
        link.click();
    };

    const attachmentsTabContent = (
        <div style={{ padding: 16 }}>
            {!isReadOnly && (
                <Dragger
                    beforeUpload={handleFileUpload}
                    showUploadList={false}
                    multiple
                    style={{ marginBottom: 16, borderRadius: 8, border: '1px dashed #d9d9d9', background: '#fafafa' }}
                >
                    <p style={{ marginBottom: 4 }}><InboxOutlined style={{ fontSize: 28, color: '#1677ff' }} /></p>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Drag files here or click to upload (max 5MB each)</p>
                </Dragger>
            )}
            {value.attachments.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>No attachments uploaded yet.</Text>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {value.attachments.map(att => (
                        <div key={att.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafbfc'
                        }}>
                            <Space size="middle">
                                {getFileIcon(att.type)}
                                <div>
                                    <Text strong style={{ fontSize: 13, display: 'block' }}>{att.name}</Text>
                                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                                        {formatBytes(att.size)} • {dayjs(att.uploaded_at).format('DD MMM YYYY, hh:mm A')}
                                    </Text>
                                </div>
                            </Space>
                            <Space>
                                <Tooltip title="Download">
                                    <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadAttachment(att)}
                                        style={{ borderColor: '#1677ff', color: '#1677ff' }} />
                                </Tooltip>
                                {!isReadOnly && (
                                    <Popconfirm title="Remove this attachment?" onConfirm={() => update({ attachments: value.attachments.filter(a => a.id !== att.id) })}>
                                        <Button size="small" icon={<DeleteOutlined />} danger />
                                    </Popconfirm>
                                )}
                            </Space>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ── Terms & Conditions Tab ──

    const termsTabContent = (
        <div style={{ padding: 16 }}>
            {!isReadOnly && (
                <div style={{ marginBottom: 8 }}>
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => update({ terms_conditions: DEFAULT_TERMS })}
                        style={{ borderColor: '#1677ff', color: '#1677ff', borderRadius: 6, marginRight: 8 }}
                    >
                        Use Default Template
                    </Button>
                    {value.terms_conditions && (
                        <Button size="small" icon={<ClearOutlined />} onClick={() => update({ terms_conditions: '' })}
                            style={{ borderRadius: 6 }}>
                            Clear
                        </Button>
                    )}
                </div>
            )}
            {isReadOnly ? (
                value.terms_conditions ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151', lineHeight: 1.8, background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        {value.terms_conditions}
                    </div>
                ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>No terms and conditions specified.</Text>
                )
            ) : (
                <TextArea
                    rows={6}
                    value={value.terms_conditions}
                    onChange={e => update({ terms_conditions: e.target.value })}
                    placeholder="Enter terms and conditions..."
                    style={{ borderRadius: 8, fontSize: 13 }}
                />
            )}
        </div>
    );

    // ── Notes Tab ──

    const notesTabContent = (
        <div style={{ padding: 16 }}>
            {isReadOnly ? (
                value.notes ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151', background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        {value.notes}
                    </div>
                ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>No notes added.</Text>
                )
            ) : (
                <TextArea
                    rows={4}
                    value={value.notes}
                    onChange={e => update({ notes: e.target.value })}
                    placeholder="Add internal notes..."
                    style={{ borderRadius: 8, fontSize: 13 }}
                />
            )}
        </div>
    );

    // ── Additional Details Tab ──

    const additionalDetailsTabContent = (
        <div style={{ padding: 16 }}>
            {!isReadOnly && (
                <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => update({
                        additional_details: [...value.additional_details, { id: uid(), key: '', value: '' }]
                    })}
                    style={{ marginBottom: 12, borderColor: '#1677ff', color: '#1677ff' }}
                >
                    Add Field
                </Button>
            )}
            {value.additional_details.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>No additional details added.</Text>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!isReadOnly && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, padding: '0 4px' }}>
                            <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Field Name</Text>
                            <Text strong style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Value</Text>
                            <div style={{ width: 32 }} />
                        </div>
                    )}
                    {value.additional_details.map(detail => (
                        <div key={detail.id} style={{ display: 'grid', gridTemplateColumns: isReadOnly ? '1fr 2fr' : '1fr 2fr auto', gap: 8, alignItems: 'center' }}>
                            {isReadOnly ? (
                                <>
                                    <Text strong style={{ fontSize: 13, color: '#374151' }}>{detail.key || '-'}</Text>
                                    <Text style={{ fontSize: 13 }}>{detail.value || '-'}</Text>
                                </>
                            ) : (
                                <>
                                    <Input
                                        size="small"
                                        value={detail.key}
                                        onChange={e => update({
                                            additional_details: value.additional_details.map(d => d.id === detail.id ? { ...d, key: e.target.value } : d)
                                        })}
                                        placeholder="Field name"
                                        style={{ borderRadius: 6 }}
                                    />
                                    <Input
                                        size="small"
                                        value={detail.value}
                                        onChange={e => update({
                                            additional_details: value.additional_details.map(d => d.id === detail.id ? { ...d, value: e.target.value } : d)
                                        })}
                                        placeholder="Value"
                                        style={{ borderRadius: 6 }}
                                    />
                                    <Button type="text" danger icon={<DeleteOutlined />} size="small"
                                        onClick={() => update({ additional_details: value.additional_details.filter(d => d.id !== detail.id) })}
                                    />
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ── Comments Tab ──

    const [newComment, setNewComment] = useState('');

    const handleAddComment = () => {
        if (!newComment.trim()) return;
        const comment: Comment = {
            id: uid(),
            author: currentUser || 'User',
            text: newComment.trim(),
            created_at: new Date().toISOString(),
        };
        update({ comments: [...value.comments, comment] });
        setNewComment('');
    };

    const commentsTabContent = (
        <div style={{ padding: 16 }}>
            {!isReadOnly && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <Input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onPressEnter={handleAddComment}
                        placeholder="Write a comment..."
                        style={{ borderRadius: 8, flex: 1 }}
                    />
                    <Button type="primary" onClick={handleAddComment} disabled={!newComment.trim()} style={{ borderRadius: 8 }}>
                        Post
                    </Button>
                </div>
            )}
            {value.comments.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>No comments yet.</Text>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {value.comments.slice().reverse().map(comment => (
                        <div key={comment.id} style={{
                            padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafbfc',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                        }}>
                            <div>
                                <Space size="small" style={{ marginBottom: 4 }}>
                                    <Tag icon={<UserOutlined />} color="blue" style={{ borderRadius: 10, fontSize: 11, padding: '0 8px' }}>
                                        {comment.author}
                                    </Tag>
                                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                                        {dayjs(comment.created_at).format('DD MMM YYYY, hh:mm A')}
                                    </Text>
                                </Space>
                                <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{comment.text}</div>
                            </div>
                            {!isReadOnly && (
                                <Popconfirm title="Delete this comment?" onConfirm={() => update({ comments: value.comments.filter(c => c.id !== comment.id) })}>
                                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                </Popconfirm>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ── Signature Tab ──

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signerName, setSignerName] = useState(value.signature_data?.signer_name || currentUser || '');

    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if ('touches' in e && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        const mouseEvent = e as React.MouseEvent<HTMLCanvasElement>;
        return { x: mouseEvent.clientX, y: mouseEvent.clientY };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || isReadOnly) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        const coords = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(coords.x - rect.left, coords.y - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const coords = getCoordinates(e);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineTo(coords.x - rect.left, coords.y - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        update({
            signature_data: {
                image_base64: base64,
                signer_name: signerName,
                signed_at: new Date().toISOString(),
            }
        });
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        update({ signature_data: null });
    };

    // Draw saved signature on canvas load
    useEffect(() => {
        if (value.signature_data?.image_base64 && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0);
                img.src = `data:image/png;base64,${value.signature_data.image_base64}`;
            }
        }
    }, [value.signature_data?.image_base64, isDrawing]); // re-draw if mode or value changes or drawing starts/stops

    const handleSignatureUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            update({
                signature_data: {
                    image_base64: base64,
                    signer_name: signerName,
                    signed_at: new Date().toISOString(),
                }
            });
            // Draw on canvas too
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    const img = new Image();
                    img.onload = () => ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                    img.src = reader.result as string;
                }
            }
        };
        reader.readAsDataURL(file);
        return false;
    };

    const signatureTabContent = (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ flex: 1 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#374151' }}>
                        {isReadOnly ? 'Signature' : 'Draw Signature'}
                    </Text>
                    {/* Canvas / Drawing area */}
                    {!isReadOnly && (
                        <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', background: '#fff', position: 'relative' }}>
                            <canvas
                                ref={canvasRef}
                                width={400}
                                height={150}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={(e) => {
                                    startDrawing(e);
                                }}
                                onTouchMove={(e) => {
                                    draw(e);
                                }}
                                onTouchEnd={stopDrawing}
                                onTouchCancel={stopDrawing}
                                style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                            />
                        </div>
                    )}
                    {/* Always show captured signature image (view mode OR after capture in create/edit mode) */}
                    {value.signature_data?.image_base64 ? (
                        <div style={{
                            marginTop: !isReadOnly ? 12 : 0,
                            border: '1px solid #b7eb8f',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: '#f6ffed',
                            padding: 8,
                        }}>
                            <Text style={{ display: 'block', fontSize: 11, color: '#52c41a', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                ✓ Captured Signature
                            </Text>
                            <img
                                src={`data:image/png;base64,${value.signature_data.image_base64}`}
                                alt="Signature"
                                style={{ width: 400, height: 150, objectFit: 'contain', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}
                            />
                        </div>
                    ) : isReadOnly ? (
                        <div style={{ width: 400, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d9d9d9', borderRadius: 8, background: '#fafafa' }}>
                            <Text type="secondary">No signature attached</Text>
                        </div>
                    ) : null}
                    {!isReadOnly && (
                        <Space style={{ marginTop: 8 }}>
                            <Button size="small" icon={<ClearOutlined />} onClick={clearSignature} style={{ borderRadius: 6 }}>
                                Clear
                            </Button>
                            <Upload beforeUpload={handleSignatureUpload} showUploadList={false} accept="image/*">
                                <Button size="small" icon={<UploadOutlined />} style={{ borderRadius: 6 }}>
                                    Upload Image
                                </Button>
                            </Upload>
                            {value.signature_data?.image_base64 && (
                                <Tag icon={<CheckOutlined />} color="success" style={{ borderRadius: 10 }}>Signature captured</Tag>
                            )}
                        </Space>
                    )}
                </div>
                <div style={{ width: 220 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#374151' }}>Signer Details</Text>
                    {isReadOnly ? (
                        <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                            <Text strong style={{ display: 'block', fontSize: 14 }}>{value.signature_data?.signer_name || '-'}</Text>
                            {value.signature_data?.signed_at && (
                                <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 4 }}>
                                    Signed: {dayjs(value.signature_data.signed_at).format('DD MMM YYYY, hh:mm A')}
                                </Text>
                            )}
                        </div>
                    ) : (
                        <>
                            <Input
                                value={signerName}
                                onChange={e => {
                                    setSignerName(e.target.value);
                                    if (value.signature_data) {
                                        update({ signature_data: { ...value.signature_data, signer_name: e.target.value } });
                                    }
                                }}
                                placeholder="Authorised signatory name"
                                style={{ borderRadius: 6 }}
                            />
                            {value.signature_data?.signed_at && (
                                <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 8 }}>
                                    Signed: {dayjs(value.signature_data.signed_at).format('DD MMM YYYY, hh:mm A')}
                                </Text>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // ─── Tab Items ─────────────────────────────────────────────

    const tabItems = [
        {
            key: 'charges',
            label: (
                <Space size={4}>
                    Extra Charges
                    {value.extra_charges.length > 0 && <Tag color="blue" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px', margin: 0 }}>{value.extra_charges.length}</Tag>}
                </Space>
            ),
            children: extraChargesTabContent,
        },
        {
            key: 'attachments',
            label: (
                <Space size={4}>
                    Attachments
                    {value.attachments.length > 0 && <Tag color="green" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px', margin: 0 }}>{value.attachments.length}</Tag>}
                </Space>
            ),
            children: attachmentsTabContent,
        },
        { key: 'terms', label: 'Terms & Conditions', children: termsTabContent },
        { key: 'notes', label: 'Notes', children: notesTabContent },
        {
            key: 'details',
            label: (
                <Space size={4}>
                    Additional Details
                    {value.additional_details.length > 0 && <Tag color="purple" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px', margin: 0 }}>{value.additional_details.length}</Tag>}
                </Space>
            ),
            children: additionalDetailsTabContent,
        },
        {
            key: 'comments',
            label: (
                <Space size={4}>
                    Comments
                    {value.comments.length > 0 && <Tag color="orange" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px', margin: 0 }}>{value.comments.length}</Tag>}
                </Space>
            ),
            children: commentsTabContent,
        },
        {
            key: 'signature',
            label: (
                <Space size={4}>
                    Signature
                    {value.signature_data?.image_base64 && <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
                </Space>
            ),
            children: signatureTabContent,
        },
    ];

    return (
        <Tabs
            type="card"
            items={tabItems}
            className="document-tabs"
            style={{ marginTop: 4 }}
        />
    );
}
