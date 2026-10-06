"""
Inventory Services.
"""
from datetime import datetime, timezone, timedelta
from typing import Sequence
from sqlalchemy import select, func, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.inventory.models import Item, StockTransaction, TransactionType, ItemCategory
from app.modules.inventory.schemas import (
    ItemCreate, ItemUpdate, StockTransactionCreate,
    StockLevelSummary, TopItemEntry, StockValuationByCategory, InventoryDashboardResponse,
)
from app.core.exceptions import NotFoundError, ConflictError

class InventoryService:
    @staticmethod
    async def generate_next_sku(db: AsyncSession) -> str:
        """Generate next SKU using MAX(id) instead of COUNT to avoid collisions from deleted rows."""
        result = await db.execute(select(func.coalesce(func.max(Item.id), 0)))
        max_id = result.scalar_one()
        return f"SKU{str(max_id + 1).zfill(5)}"

    @staticmethod
    async def create_item(db: AsyncSession, data: ItemCreate) -> Item:
        existing = await db.execute(select(Item).where(Item.sku == data.sku))
        if existing.scalar_one_or_none():
            raise ConflictError("Item with this SKU already exists")
        
        item = Item(**data.model_dump())
        db.add(item)
        await db.flush()
        return item

    @staticmethod
    async def get_item(db: AsyncSession, item_id: int) -> Item:
        item = await db.get(Item, item_id)
        if not item:
            raise NotFoundError("Item not found")
        return item

    @staticmethod
    async def list_items(db: AsyncSession, skip: int = 0, limit: int = 100) -> tuple[Sequence[Item], int]:
        result = await db.execute(select(Item).offset(skip).limit(limit))
        items = result.scalars().all()
        
        total_res = await db.execute(select(func.count(Item.id)))
        total = total_res.scalar_one()
        return items, total

    @staticmethod
    async def update_item(db: AsyncSession, item_id: int, data: ItemUpdate) -> Item:
        item = await InventoryService.get_item(db, item_id)
        update_data = data.model_dump(exclude_unset=True)
        # If SKU is being changed, check uniqueness
        if "sku" in update_data and update_data["sku"] != item.sku:
            existing = await db.execute(select(Item).where(Item.sku == update_data["sku"]))
            if existing.scalar_one_or_none():
                raise ConflictError("Item with this SKU already exists")
        for key, value in update_data.items():
            setattr(item, key, value)
        return item

    @staticmethod
    async def add_stock_transaction(db: AsyncSession, data: StockTransactionCreate) -> StockTransaction:
        # Use SELECT ... FOR UPDATE to prevent race conditions on concurrent stock updates
        result = await db.execute(
            select(Item).where(Item.id == data.item_id).with_for_update()
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError("Item not found")

        tx = StockTransaction(**data.model_dump())
        db.add(tx)
        
        # Update current stock with proper validation
        if data.transaction_type == TransactionType.IN:
            item.current_stock = float(item.current_stock) + float(data.quantity)
        elif data.transaction_type == TransactionType.OUT:
            new_stock = float(item.current_stock) - float(data.quantity)
            if new_stock < 0:
                raise ConflictError(
                    f"Insufficient stock for item {item.sku}. "
                    f"Available: {item.current_stock}, Requested: {data.quantity}"
                )
            item.current_stock = new_stock
        elif data.transaction_type == TransactionType.ADJUSTMENT:
            item.current_stock = float(data.quantity)

        await db.flush()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def list_stock_transactions(db: AsyncSession, item_id: int | None = None, skip: int = 0, limit: int = 100) -> tuple[Sequence[StockTransaction], int]:
        query = select(StockTransaction)
        if item_id:
            query = query.where(StockTransaction.item_id == item_id)
            
        result = await db.execute(query.offset(skip).limit(limit))
        txs = result.scalars().all()
        
        count_q = select(func.count(StockTransaction.id))
        if item_id:
            count_q = count_q.where(StockTransaction.item_id == item_id)
        total = (await db.execute(count_q)).scalar_one()
        
        return txs, total

    @staticmethod
    async def get_dashboard(db: AsyncSession) -> InventoryDashboardResponse:
        # ── All items ──
        result = await db.execute(select(Item))
        items = result.scalars().all()
        total_items = len(items)

        # ── Stock Valuation ──
        stock_valuation_value = sum(
            float(i.current_stock or 0) * float(i.default_price or 0) for i in items
        )

        # ── Stock Level categories ──
        negative = low = reorder = optimum = high = excess = 0
        for i in items:
            stock = float(i.current_stock or 0)
            min_lvl = float(i.min_stock_level or 0)
            max_lvl = float(i.max_stock_level or 0)
            reorder_lvl = float(i.reorder_level or 0)

            if stock < 0:
                negative += 1
            elif min_lvl > 0 and stock < min_lvl:
                low += 1
            elif reorder_lvl > 0 and stock <= reorder_lvl:
                reorder += 1
            elif max_lvl > 0 and stock > max_lvl:
                excess += 1
            elif max_lvl > 0 and stock > max_lvl * 0.85:
                high += 1
            else:
                optimum += 1

        stock_levels = StockLevelSummary(
            negative_stock=negative,
            low_stock=low,
            reorder_stock=reorder,
            optimum_stock=optimum,
            high_stock=high,
            excess_stock=excess,
            total_items=total_items,
        )

        # ── Top 5 selling items (last 3 months) ──
        top_selling: list[TopItemEntry] = []
        try:
            from app.modules.sales.models import SalesOrderItem, SalesOrder
            three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
            sell_q = (
                select(
                    SalesOrderItem.item_id,
                    Item.name.label("item_name"),
                    func.count(func.distinct(SalesOrderItem.sales_order_id)).label("invoices"),
                    func.sum(SalesOrderItem.total_price).label("traded_amount"),
                )
                .join(Item, SalesOrderItem.item_id == Item.id)
                .join(SalesOrder, SalesOrderItem.sales_order_id == SalesOrder.id)
                .where(SalesOrder.order_date >= three_months_ago)
                .group_by(SalesOrderItem.item_id, Item.name)
                .order_by(func.sum(SalesOrderItem.total_price).desc())
                .limit(5)
            )
            sell_rows = (await db.execute(sell_q)).all()
            top_selling = [
                TopItemEntry(
                    item_id=r.item_id,
                    item_name=r.item_name,
                    invoices=r.invoices,
                    traded_amount=float(r.traded_amount or 0),
                )
                for r in sell_rows
            ]
        except Exception:
            pass

        # ── Top 5 purchased items (last 3 months) ──
        top_purchased: list[TopItemEntry] = []
        try:
            from app.modules.purchases.models import POItem, PurchaseOrder
            three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
            buy_q = (
                select(
                    POItem.item_id,
                    Item.name.label("item_name"),
                    func.count(func.distinct(POItem.po_id)).label("invoices"),
                    func.sum(POItem.ordered_quantity * POItem.unit_price).label("traded_amount"),
                )
                .join(Item, POItem.item_id == Item.id)
                .join(PurchaseOrder, POItem.po_id == PurchaseOrder.id)
                .where(PurchaseOrder.order_date >= three_months_ago)
                .group_by(POItem.item_id, Item.name)
                .order_by(func.sum(POItem.ordered_quantity * POItem.unit_price).desc())
                .limit(5)
            )
            buy_rows = (await db.execute(buy_q)).all()
            top_purchased = [
                TopItemEntry(
                    item_id=r.item_id,
                    item_name=r.item_name,
                    invoices=r.invoices,
                    traded_amount=float(r.traded_amount or 0),
                )
                for r in buy_rows
            ]
        except Exception:
            pass

        # ── Valuation by category ──
        cat_map: dict[str, dict] = {}
        for i in items:
            cat = (i.category.value if i.category else "uncategorised")
            entry = cat_map.setdefault(cat, {"value": 0.0, "count": 0})
            entry["value"] += float(i.current_stock or 0) * float(i.default_price or 0)
            entry["count"] += 1
        valuation_by_category = [
            StockValuationByCategory(category=k, value=v["value"], count=v["count"])
            for k, v in cat_map.items()
        ]

        return InventoryDashboardResponse(
            stock_valuation_value=stock_valuation_value,
            stock_valuation_count=total_items,
            stock_levels=stock_levels,
            top_selling_items=top_selling,
            top_purchased_items=top_purchased,
            valuation_by_category=valuation_by_category,
            last_updated=datetime.now(timezone.utc),
        )