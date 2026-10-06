"""
Inventory API Router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.inventory.schemas import (
    ItemCreate, ItemUpdate, ItemResponse, ItemListResponse,
    StockTransactionCreate, StockTransactionResponse, StockTransactionListResponse,
    InventoryDashboardResponse,
)
from app.modules.inventory.services import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/dashboard", response_model=InventoryDashboardResponse)
async def inventory_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    return await InventoryService.get_dashboard(db)

@router.get("/items/next-sku", response_model=dict)
async def next_sku(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    sku = await InventoryService.generate_next_sku(db)
    return {"sku": sku}

@router.post("/items", response_model=ItemResponse)
async def create_item(data: ItemCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    return await InventoryService.create_item(db, data)

@router.get("/items", response_model=ItemListResponse)
async def list_items(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    items, total = await InventoryService.list_items(db, skip, limit)
    return {"items": items, "total": total}

@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    return await InventoryService.get_item(db, item_id)

@router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, data: ItemUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    return await InventoryService.update_item(db, item_id, data)

@router.post("/transactions", response_model=StockTransactionResponse)
async def add_stock_transaction(data: StockTransactionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    return await InventoryService.add_stock_transaction(db, data)

@router.get("/transactions", response_model=StockTransactionListResponse)
async def list_transactions(item_id: int | None = None, skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_module(Module.INVENTORY))):
    txs, total = await InventoryService.list_stock_transactions(db, item_id, skip, limit)
    return {"transactions": txs, "total": total}
