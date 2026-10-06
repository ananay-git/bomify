"""
Dispatch Router — API endpoints for the Dispatch module.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.dispatch.schemas import (
    DispatchCreate, DispatchUpdate, DispatchStatusUpdate, DispatchShipRequest,
    DispatchResponse, DispatchListResponse, NextDispatchNumberResponse,
)
from app.modules.dispatch.services import DispatchService

router = APIRouter(prefix="/dispatch", tags=["Dispatch"])




def _serialize_item(item) -> dict:
    """Serialize a DispatchItem with enriched inventory data."""
    data = {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": float(item.quantity),
        "picked_quantity": float(item.picked_quantity) if item.picked_quantity else 0,
        "packed_quantity": float(item.packed_quantity) if item.packed_quantity else 0,
    }
    if hasattr(item, 'inventory_item') and item.inventory_item:
        inv = item.inventory_item
        data["item_name"] = inv.name
        data["item_sku"] = inv.sku
        data["item_hsn"] = inv.hsn_code
        data["item_uom"] = inv.unit_of_measure
        data["available_stock"] = float(inv.current_stock)
    return data


def _serialize_dispatch(dispatch) -> dict:
    """Serialize a Dispatch with enriched relationships."""
    items = [_serialize_item(item) for item in dispatch.items] if dispatch.items else []

    sales_order = None
    if hasattr(dispatch, 'sales_order') and dispatch.sales_order:
        so = dispatch.sales_order
        customer = None
        if hasattr(so, 'customer') and so.customer:
            c = so.customer
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
        sales_order = {
            "id": so.id,
            "order_number": so.order_number,
            "status": so.status.value if hasattr(so.status, 'value') else so.status,
            "customer_id": so.customer_id,
            "total_amount": float(so.total_amount) if so.total_amount else None,
            "order_date": so.order_date.isoformat() if so.order_date else None,
            "expected_delivery_date": so.expected_delivery_date.isoformat() if so.expected_delivery_date else None,
            "customer": customer,
        }

    return {
        "id": dispatch.id,
        "dispatch_number": dispatch.dispatch_number,
        "sales_order_id": dispatch.sales_order_id,
        "status": dispatch.status.value if hasattr(dispatch.status, 'value') else dispatch.status,
        "logistics_partner": dispatch.logistics_partner,
        "tracking_number": dispatch.tracking_number,
        "dispatch_date": dispatch.dispatch_date.isoformat() if dispatch.dispatch_date else None,
        "expected_delivery": dispatch.expected_delivery.isoformat() if dispatch.expected_delivery else None,
        "delivered_date": dispatch.delivered_date.isoformat() if dispatch.delivered_date else None,
        "vehicle_details": dispatch.vehicle_details,
        "driver_name": dispatch.driver_name,
        "driver_phone": dispatch.driver_phone,
        "notes": dispatch.notes,
        "created_at": dispatch.created_at.isoformat() if dispatch.created_at else None,
        "updated_at": dispatch.updated_at.isoformat() if dispatch.updated_at else None,
        "items": items,
        "sales_order": sales_order,
    }


# ─── Next Number ────────────────────────────────────────────────

@router.get("/dispatches/next-number")
async def get_next_number(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    number = await DispatchService.get_next_number(db)
    return {"dispatch_number": number}


# ─── Dispatchable Sales Orders ──────────────────────────────────

@router.get("/sales-orders/dispatchable")
async def get_dispatchable_sales_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    orders = await DispatchService.get_dispatchable_sales_orders(db)
    return {"orders": orders}


@router.get("/production-ready")
async def get_production_ready_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    items = await DispatchService.get_production_ready_items(db)
    return {"items": items}


# ─── CRUD ───────────────────────────────────────────────────────

@router.post("/dispatches")
async def create_dispatch(
    data: DispatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.create_dispatch(db, data)
    return _serialize_dispatch(dispatch)


@router.get("/dispatches")
async def list_dispatches(
    skip: int = 0,
    limit: int = 100,
    status: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatches, total = await DispatchService.list_dispatches(db, skip, limit, status, search)
    return {
        "dispatches": [_serialize_dispatch(d) for d in dispatches],
        "total": total,
    }


@router.get("/dispatches/{dispatch_id}")
async def get_dispatch(
    dispatch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.get_dispatch(db, dispatch_id)
    return _serialize_dispatch(dispatch)


@router.put("/dispatches/{dispatch_id}")
async def update_dispatch(
    dispatch_id: int,
    data: DispatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.update_dispatch(db, dispatch_id, data)
    return _serialize_dispatch(dispatch)


# ─── Status Transitions ────────────────────────────────────────

@router.post("/dispatches/{dispatch_id}/pack")
async def pack_dispatch(
    dispatch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.pack_dispatch(db, dispatch_id)
    return _serialize_dispatch(dispatch)


@router.post("/dispatches/{dispatch_id}/ship")
async def ship_dispatch(
    dispatch_id: int,
    data: DispatchShipRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    tracking = data.tracking_number if data else None
    logistics = data.logistics_partner if data else None
    dispatch = await DispatchService.ship_dispatch(db, dispatch_id, tracking, logistics)
    return _serialize_dispatch(dispatch)


@router.post("/dispatches/{dispatch_id}/deliver")
async def deliver_dispatch(
    dispatch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.deliver_dispatch(db, dispatch_id)
    return _serialize_dispatch(dispatch)


@router.delete("/dispatches/{dispatch_id}")
async def cancel_dispatch(
    dispatch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.DISPATCH)),
):
    dispatch = await DispatchService.cancel_dispatch(db, dispatch_id)
    return _serialize_dispatch(dispatch)
