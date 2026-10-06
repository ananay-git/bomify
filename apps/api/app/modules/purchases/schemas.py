"""
Purchases Pydantic schemas.
"""
from typing import Sequence
from datetime import datetime
from pydantic import BaseModel
from app.modules.purchases.models import POStatus, PaymentStatus, InvoiceStatus, GoodsStatus, DocumentType

class POItemCreate(BaseModel):
    item_id: int
    ordered_quantity: float
    unit_price: float

class POItemResponse(POItemCreate):
    id: int
    received_quantity: float
    model_config = {"from_attributes": True}

class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_id: int
    document_type: DocumentType | None = None
    linked_sales_order_id: int | None = None
    status: POStatus | None = None
    billing_location_id: int | None = None
    delivery_location_id: int | None = None
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    items: list[POItemCreate]
    # Document tab fields
    extra_charges: list[dict] | None = None
    terms_conditions: str | None = None
    comments: list[dict] | None = None
    additional_details: list[dict] | None = None
    signature_data: dict | None = None
    attachments: list[dict] | None = None

class PurchaseOrderUpdate(BaseModel):
    status: POStatus | None = None
    payment_status: PaymentStatus | None = None
    invoice_status: InvoiceStatus | None = None
    goods_status: GoodsStatus | None = None
    document_type: DocumentType | None = None
    linked_sales_order_id: int | None = None
    billing_location_id: int | None = None
    delivery_location_id: int | None = None
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    items: list[POItemCreate] | None = None
    # Document tab fields
    extra_charges: list[dict] | None = None
    terms_conditions: str | None = None
    comments: list[dict] | None = None
    additional_details: list[dict] | None = None
    signature_data: dict | None = None
    attachments: list[dict] | None = None

class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: str | None = None
    document_type: DocumentType
    linked_sales_order_id: int | None = None
    linked_sales_order_number: str | None = None
    billing_location_id: int | None
    delivery_location_id: int | None
    status: POStatus
    payment_status: PaymentStatus
    invoice_status: InvoiceStatus
    goods_status: GoodsStatus
    order_date: datetime
    expected_delivery_date: datetime | None
    total_amount: float
    notes: str | None
    # Document tab fields
    extra_charges: list[dict] | None = None
    terms_conditions: str | None = None
    comments: list[dict] | None = None
    additional_details: list[dict] | None = None
    signature_data: dict | None = None
    attachments: list[dict] | None = None
    created_at: datetime
    updated_at: datetime
    
    items: list[POItemResponse] = []
    
    model_config = {"from_attributes": True}

class PurchaseOrderListResponse(BaseModel):
    orders: Sequence[PurchaseOrderResponse]
    total: int

# GRN Schemas
class GRNItemCreate(BaseModel):
    item_id: int
    received_quantity: float
    accepted_quantity: float
    rejected_quantity: float = 0.0

class GRNCreate(BaseModel):
    po_id: int
    grn_number: str
    delivery_date: datetime | None = None
    notes: str | None = None
    items: list[GRNItemCreate]

class GRNItemResponse(GRNItemCreate):
    id: int
    model_config = {"from_attributes": True}

class GRNResponse(BaseModel):
    id: int
    po_id: int
    grn_number: str
    receipt_date: datetime
    delivery_date: datetime | None
    notes: str | None
    created_at: datetime
    
    items: list[GRNItemResponse] = []
    
    model_config = {"from_attributes": True}
