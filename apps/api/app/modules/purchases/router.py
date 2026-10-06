"""
Purchases Router — with cross-module endpoints.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.purchases.schemas import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse, PurchaseOrderListResponse,
    GRNCreate, GRNResponse
)
from app.modules.purchases.services import PurchasesService

router = APIRouter(prefix="/purchases", tags=["Purchases"])


# ─── Stats (Dashboard) ────────────────────────────────────────

@router.get("/orders/stats")
async def get_purchase_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    """Purchase statistics for the dashboard — total orders, value, pending, overdue."""
    return await PurchasesService.get_stats(db)

# ─── CRUD ──────────────────────────────────────────────────────

@router.post("/orders", response_model=PurchaseOrderResponse)
async def create_po(
    data: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.create_po(db, data)

@router.get("/orders", response_model=PurchaseOrderListResponse)
async def list_pos(
    skip: int = 0,
    limit: int = 100,
    document_type: str | None = Query(None, description="Filter by document type"),
    status: str | None = Query(None, description="Filter by status"),
    search: str | None = Query(None, description="Search by PO number or supplier name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    orders, total = await PurchasesService.list_pos(
        db, skip, limit,
        document_type=document_type,
        status=status,
        search=search,
    )
    return {"orders": orders, "total": total}

@router.get("/orders/{po_id}", response_model=PurchaseOrderResponse)
async def get_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.get_po(db, po_id)

@router.put("/orders/{po_id}", response_model=PurchaseOrderResponse)
async def update_po(
    po_id: int,
    data: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.update_po(db, po_id, data)

# ─── Cancel ────────────────────────────────────────────────────

@router.post("/orders/{po_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    """Cancel a Purchase Order with optional inventory rollback."""
    return await PurchasesService.cancel_po(db, po_id)

# ─── GRN / Inward ─────────────────────────────────────────────

@router.post("/grn", response_model=GRNResponse)
async def create_grn(
    data: GRNCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.create_grn(db, data)

@router.get("/grn/{grn_id}", response_model=GRNResponse)
async def get_grn(
    grn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.get_grn(db, grn_id)

@router.get("/orders/{po_id}/grns", response_model=list[GRNResponse])
async def list_grns_by_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_module(Module.PURCHASES)),
):
    return await PurchasesService.list_grns_by_po(db, po_id)
