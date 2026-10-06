"""
Sales Router — API endpoints for the Sales Order module.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.sales.schemas import (
    SalesOrderCreate, SalesOrderUpdate,
    SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemResponse, NextNumberResponse,
)
from app.modules.sales.services import SalesService

router = APIRouter(prefix="/sales", tags=["Sales"])




def _serialize_order(order) -> dict:
    """Serialize SalesOrder with enriched items and customer."""
    items = []
    for item in order.items:
        item_dict = {
            "id": item.id,
            "item_id": item.item_id,
            "description": item.description,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "discount": float(item.discount) if item.discount else 0,
            "tax_rate": float(item.tax_rate) if item.tax_rate else 0,
            "subtotal": float(item.subtotal) if item.subtotal else 0,
            "total_price": float(item.total_price),
        }
        if hasattr(item, 'inventory_item') and item.inventory_item:
            inv = item.inventory_item
            item_dict["item_name"] = inv.name
            item_dict["item_sku"] = inv.sku
            item_dict["item_hsn"] = inv.hsn_code
            item_dict["item_uom"] = inv.unit_of_measure
            item_dict["available_stock"] = float(inv.current_stock)
        items.append(item_dict)

    customer = None
    if hasattr(order, 'customer') and order.customer:
        c = order.customer
        customer = {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "gstin": c.gstin,
            "address": c.address,
            "city": c.city,
            "state": c.state,
            "pincode": c.pincode,
        }

    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "status": order.status.value if hasattr(order.status, 'value') else order.status,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "expected_delivery_date": order.expected_delivery_date.isoformat() if order.expected_delivery_date else None,
        "payment_terms": order.payment_terms,
        "billing_address": order.billing_address,
        "shipping_address": order.shipping_address,
        "total_amount": float(order.total_amount) if order.total_amount else 0,
        "tax_amount": float(order.tax_amount) if order.tax_amount else 0,
        "discount_amount": float(order.discount_amount) if order.discount_amount else 0,
        "notes": order.notes,
        "extra_charges": order.extra_charges,
        "terms_conditions": order.terms_conditions,
        "comments": order.comments,
        "additional_details": order.additional_details,
        "signature_data": order.signature_data,
        "attachments": order.attachments,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "items": items,
        "customer": customer,
    }


@router.get("/orders/next-number")
async def get_next_number(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    number = await SalesService.get_next_number(db)
    return {"order_number": number}


@router.post("/orders")
async def create_order(
    data: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.create_order(db, data)
    return _serialize_order(order)


@router.get("/orders")
async def list_orders(
    skip: int = 0,
    limit: int = 100,
    status: str | None = Query(None),
    search: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    orders, total = await SalesService.list_orders(
        db, skip, limit, status, search, date_from, date_to
    )
    return {
        "orders": [_serialize_order(o) for o in orders],
        "total": total,
    }


@router.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.get_order(db, order_id)
    return _serialize_order(order)


@router.put("/orders/{order_id}")
async def update_order(
    order_id: int,
    data: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.update_order(db, order_id, data)
    return _serialize_order(order)


@router.post("/orders/{order_id}/confirm")
async def confirm_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.confirm_order(db, order_id)
    return _serialize_order(order)


@router.post("/orders/{order_id}/process")
async def process_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.process_order(db, order_id)
    return _serialize_order(order)


@router.post("/orders/{order_id}/ship")
async def ship_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.ship_order(db, order_id)
    return _serialize_order(order)


@router.post("/orders/{order_id}/invoice")
async def invoice_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.invoice_order(db, order_id)
    return _serialize_order(order)


@router.post("/orders/{order_id}/pay")
async def mark_paid(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.mark_paid(db, order_id)
    return _serialize_order(order)


@router.delete("/orders/{order_id}")
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.SALES)),
):
    order = await SalesService.cancel_order(db, order_id)
    return _serialize_order(order)
