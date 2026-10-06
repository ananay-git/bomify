"""
Dispatch Pydantic schemas.
"""
from typing import Sequence
from datetime import datetime
from pydantic import BaseModel, Field
from app.modules.dispatch.models import DispatchStatus


# ─── Item Schemas ───────────────────────────────────────────────

class DispatchItemCreate(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    picked_quantity: float = 0
    packed_quantity: float = 0


class DispatchItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: float
    picked_quantity: float
    packed_quantity: float

    # Enriched from inventory
    item_name: str | None = None
    item_sku: str | None = None
    item_hsn: str | None = None
    item_uom: str | None = None
    available_stock: float | None = None

    model_config = {"from_attributes": True}


# ─── Customer Info (nested in response) ─────────────────────────

class DispatchCustomerInfo(BaseModel):
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


# ─── Sales Order Info (nested in response) ──────────────────────

class DispatchSalesOrderInfo(BaseModel):
    id: int
    order_number: str
    status: str
    customer_id: int
    total_amount: float | None = None
    order_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    customer: DispatchCustomerInfo | None = None

    model_config = {"from_attributes": True}


# ─── Dispatch Schemas ───────────────────────────────────────────

class DispatchCreate(BaseModel):
    sales_order_id: int | None = None
    production_process_id: int | None = None
    dispatch_date: datetime | None = None
    expected_delivery: datetime | None = None
    logistics_partner: str | None = None
    vehicle_details: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    notes: str | None = None
    items: list[DispatchItemCreate] = Field(min_length=1)


class DispatchUpdate(BaseModel):
    dispatch_date: datetime | None = None
    expected_delivery: datetime | None = None
    logistics_partner: str | None = None
    tracking_number: str | None = None
    vehicle_details: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    notes: str | None = None


class DispatchStatusUpdate(BaseModel):
    status: DispatchStatus
    tracking_number: str | None = None
    logistics_partner: str | None = None


class DispatchShipRequest(BaseModel):
    tracking_number: str | None = None
    logistics_partner: str | None = None


class DispatchResponse(BaseModel):
    id: int
    dispatch_number: str
    sales_order_id: int | None
    production_process_id: int | None
    status: DispatchStatus
    logistics_partner: str | None
    tracking_number: str | None
    dispatch_date: datetime | None
    expected_delivery: datetime | None
    delivered_date: datetime | None
    vehicle_details: str | None
    driver_name: str | None
    driver_phone: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    items: list[DispatchItemResponse] = []
    sales_order: DispatchSalesOrderInfo | None = None

    model_config = {"from_attributes": True}


class DispatchListResponse(BaseModel):
    dispatches: Sequence[DispatchResponse]
    total: int


class NextDispatchNumberResponse(BaseModel):
    dispatch_number: str


# ─── Dispatchable Sales Orders ──────────────────────────────────

class DispatchableSalesOrderItem(BaseModel):
    item_id: int
    item_name: str | None = None
    item_sku: str | None = None
    item_uom: str | None = None
    ordered_quantity: float
    already_dispatched: float
    remaining_quantity: float
    available_stock: float | None = None


class DispatchableSalesOrder(BaseModel):
    id: int
    order_number: str
    status: str
    customer_id: int
    customer_name: str | None = None
    total_amount: float | None = None
    order_date: datetime | None = None
    items: list[DispatchableSalesOrderItem] = []
