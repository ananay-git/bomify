"""
Sales Pydantic schemas.
"""
from typing import Sequence
from datetime import datetime
from pydantic import BaseModel, Field
from app.modules.sales.models import OrderStatus


# ─── Item Schemas ───────────────────────────────────────────────

class SalesOrderItemCreate(BaseModel):
    item_id: int
    description: str | None = None
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0, le=100)  # percentage
    tax_rate: float = Field(default=0, ge=0)  # percentage e.g. 18


class SalesOrderItemUpdate(BaseModel):
    item_id: int
    description: str | None = None
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0, le=100)
    tax_rate: float = Field(default=0, ge=0)


class SalesOrderItemResponse(BaseModel):
    id: int
    item_id: int
    description: str | None = None
    quantity: float
    unit_price: float
    discount: float
    tax_rate: float
    subtotal: float
    total_price: float

    # Enriched from inventory relationship
    item_name: str | None = None
    item_sku: str | None = None
    item_hsn: str | None = None
    item_uom: str | None = None
    available_stock: float | None = None

    model_config = {"from_attributes": True}


# ─── Customer Info (nested in response) ─────────────────────────

class CustomerInfo(BaseModel):
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    gstin: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None

    model_config = {"from_attributes": True}


# ─── Order Schemas ──────────────────────────────────────────────

class SalesOrderCreate(BaseModel):
    customer_id: int
    expected_delivery_date: datetime | None = None
    payment_terms: str | None = None
    billing_address: dict | None = None
    shipping_address: dict | None = None
    notes: str | None = None
    items: list[SalesOrderItemCreate] = Field(min_length=1)
    # Document tab fields
    extra_charges: list[dict] | None = None
    terms_conditions: str | None = None
    comments: list[dict] | None = None
    additional_details: list[dict] | None = None
    signature_data: dict | None = None
    attachments: list[dict] | None = None


class SalesOrderUpdate(BaseModel):
    customer_id: int | None = None
    expected_delivery_date: datetime | None = None
    payment_terms: str | None = None
    billing_address: dict | None = None
    shipping_address: dict | None = None
    notes: str | None = None
    items: list[SalesOrderItemUpdate] | None = None
    # Document tab fields
    extra_charges: list[dict] | None = None
    terms_conditions: str | None = None
    comments: list[dict] | None = None
    additional_details: list[dict] | None = None
    signature_data: dict | None = None
    attachments: list[dict] | None = None


class SalesOrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    status: OrderStatus
    order_date: datetime
    expected_delivery_date: datetime | None
    payment_terms: str | None
    billing_address: dict | None
    shipping_address: dict | None
    total_amount: float
    tax_amount: float
    discount_amount: float
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

    items: list[SalesOrderItemResponse] = []
    customer: CustomerInfo | None = None

    model_config = {"from_attributes": True}


class SalesOrderListResponse(BaseModel):
    orders: Sequence[SalesOrderResponse]
    total: int


class NextNumberResponse(BaseModel):
    order_number: str
