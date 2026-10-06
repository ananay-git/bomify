"""
Dispatch Services — Business logic for the Dispatch module.
"""
from typing import Sequence
from datetime import datetime, timezone
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.dispatch.models import Dispatch, DispatchItem, DispatchStatus
from app.modules.dispatch.schemas import DispatchCreate, DispatchUpdate
from app.modules.sales.models import SalesOrder, SalesOrderItem, OrderStatus
from app.modules.inventory.models import Item, StockTransaction, TransactionType
from app.modules.parties.models import Party
from app.core.exceptions import NotFoundError, ConflictError


# Valid status transitions
VALID_TRANSITIONS: dict[DispatchStatus, list[DispatchStatus]] = {
    DispatchStatus.DRAFT: [DispatchStatus.PACKED, DispatchStatus.CANCELLED],
    DispatchStatus.PACKED: [DispatchStatus.SHIPPED, DispatchStatus.CANCELLED],
    DispatchStatus.SHIPPED: [DispatchStatus.DELIVERED],
    DispatchStatus.DELIVERED: [],
    DispatchStatus.CANCELLED: [],
}

# Sales order statuses that allow dispatch creation
DISPATCHABLE_STATUSES = {OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PAID}


class DispatchService:

    # ─── Number Generation ──────────────────────────────────────

    @staticmethod
    async def _generate_dispatch_number(db: AsyncSession) -> str:
        """Generate sequential dispatch number like DSP-2026-0001."""
        year = datetime.now(timezone.utc).year
        prefix = f"DSP-{year}-"

        result = await db.execute(
            select(Dispatch.dispatch_number)
            .where(Dispatch.dispatch_number.like(f"{prefix}%"))
            .order_by(Dispatch.id.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()

        if last:
            try:
                seq = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1

        return f"{prefix}{seq:04d}"

    @staticmethod
    async def get_next_number(db: AsyncSession) -> str:
        return await DispatchService._generate_dispatch_number(db)

    # ─── Load with relationships ────────────────────────────────

    @staticmethod
    async def _load_dispatch(db: AsyncSession, dispatch_id: int) -> Dispatch:
        """Load a dispatch with all relationships for response serialization."""
        result = await db.execute(
            select(Dispatch)
            .options(
                selectinload(Dispatch.items).joinedload(DispatchItem.inventory_item),
                joinedload(Dispatch.sales_order).joinedload(SalesOrder.customer),
            )
            .where(Dispatch.id == dispatch_id)
        )
        dispatch = result.unique().scalar_one_or_none()
        if not dispatch:
            raise NotFoundError("Dispatch not found")
        return dispatch

    # ─── Get already dispatched quantities for a Sales Order ────

    @staticmethod
    async def _get_dispatched_quantities(db: AsyncSession, sales_order_id: int) -> dict[int, float]:
        """Returns {product_id: total_dispatched_qty} for non-cancelled dispatches."""
        result = await db.execute(
            select(DispatchItem.product_id, func.sum(DispatchItem.quantity))
            .join(Dispatch, DispatchItem.dispatch_id == Dispatch.id)
            .where(
                Dispatch.sales_order_id == sales_order_id,
                Dispatch.status != DispatchStatus.CANCELLED,
            )
            .group_by(DispatchItem.product_id)
        )
        return {row[0]: float(row[1]) for row in result.all()}

    # ─── Create ─────────────────────────────────────────────────

    @staticmethod
    async def create_dispatch(db: AsyncSession, data: DispatchCreate) -> Dispatch:
        """Create a dispatch. Can be from a sales order or a direct dispatch."""
        # Validate sales order if provided
        sales_order = None
        if data.sales_order_id:
            so_result = await db.execute(
                select(SalesOrder)
                .options(selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item))
                .where(SalesOrder.id == data.sales_order_id)
            )
            sales_order = so_result.unique().scalar_one_or_none()
            if not sales_order:
                raise NotFoundError("Sales order not found")

        if sales_order and sales_order.status not in DISPATCHABLE_STATUSES:
            raise ConflictError(
                f"Cannot create dispatch for order in '{sales_order.status.value}' status. "
                f"Order must be in: {', '.join(s.value for s in DISPATCHABLE_STATUSES)}"
            )

        # Get already dispatched quantities
        dispatched_map = {}
        so_items_map: dict[int, SalesOrderItem] = {}
        
        if data.sales_order_id:
            dispatched_map = await DispatchService._get_dispatched_quantities(db, data.sales_order_id)
            for so_item in sales_order.items:
                so_items_map[so_item.item_id] = so_item

        # Generate dispatch number
        dispatch_number = await DispatchService._generate_dispatch_number(db)

        dispatch = Dispatch(
            dispatch_number=dispatch_number,
            sales_order_id=data.sales_order_id,
            production_process_id=data.production_process_id,
            status=DispatchStatus.DRAFT,
            dispatch_date=data.dispatch_date or datetime.now(timezone.utc),
            expected_delivery=data.expected_delivery,
            logistics_partner=data.logistics_partner,
            vehicle_details=data.vehicle_details,
            driver_name=data.driver_name,
            driver_phone=data.driver_phone,
            notes=data.notes,
        )
        db.add(dispatch)
        await db.flush()

        # Validate and create dispatch items
        for item_data in data.items:
            if data.sales_order_id:
                # Check item is part of the sales order
                so_item = so_items_map.get(item_data.product_id)
                if not so_item:
                    raise ConflictError(
                        f"Product {item_data.product_id} is not part of Sales Order {sales_order.order_number}"
                    )

                # Check quantity doesn't exceed remaining
                ordered_qty = float(so_item.quantity)
                already_dispatched = dispatched_map.get(item_data.product_id, 0)
                remaining = ordered_qty - already_dispatched

                if item_data.quantity > remaining:
                    inv_item = so_item.inventory_item
                    item_name = inv_item.name if inv_item else f"Product #{item_data.product_id}"
                    raise ConflictError(
                        f"Cannot dispatch {item_data.quantity} of '{item_name}'. "
                        f"Ordered: {ordered_qty}, Already dispatched: {already_dispatched}, Remaining: {remaining}"
                    )

            dispatch_item = DispatchItem(
                dispatch_id=dispatch.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                picked_quantity=item_data.picked_quantity,
                packed_quantity=item_data.packed_quantity,
            )
            db.add(dispatch_item)

        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch.id)

    # ─── Get / List ─────────────────────────────────────────────

    @staticmethod
    async def get_dispatch(db: AsyncSession, dispatch_id: int) -> Dispatch:
        return await DispatchService._load_dispatch(db, dispatch_id)

    @staticmethod
    async def list_dispatches(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
        search: str | None = None,
    ) -> tuple[Sequence[Dispatch], int]:
        query = (
            select(Dispatch)
            .options(
                selectinload(Dispatch.items).joinedload(DispatchItem.inventory_item),
                joinedload(Dispatch.sales_order).joinedload(SalesOrder.customer),
            )
        )
        count_query = select(func.count(Dispatch.id))

        # Filter by status
        if status and status != "all":
            try:
                status_enum = DispatchStatus(status)
                query = query.where(Dispatch.status == status_enum)
                count_query = count_query.where(Dispatch.status == status_enum)
            except ValueError:
                pass

        # Search by dispatch number, SO number, or customer name
        if search:
            search_term = f"%{search}%"
            query = (
                query.outerjoin(SalesOrder, Dispatch.sales_order_id == SalesOrder.id)
                .outerjoin(Party, SalesOrder.customer_id == Party.id)
                .where(
                    or_(
                        Dispatch.dispatch_number.ilike(search_term),
                        SalesOrder.order_number.ilike(search_term),
                        Party.name.ilike(search_term),
                    )
                )
            )
            count_query = (
                count_query.outerjoin(SalesOrder, Dispatch.sales_order_id == SalesOrder.id)
                .outerjoin(Party, SalesOrder.customer_id == Party.id)
                .where(
                    or_(
                        Dispatch.dispatch_number.ilike(search_term),
                        SalesOrder.order_number.ilike(search_term),
                        Party.name.ilike(search_term),
                    )
                )
            )

        query = query.order_by(Dispatch.id.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        dispatches = result.unique().scalars().all()

        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        return dispatches, total

    # ─── Update ─────────────────────────────────────────────────

    @staticmethod
    async def update_dispatch(db: AsyncSession, dispatch_id: int, data: DispatchUpdate) -> Dispatch:
        dispatch = await DispatchService._load_dispatch(db, dispatch_id)

        if dispatch.status not in (DispatchStatus.DRAFT, DispatchStatus.PACKED):
            raise ConflictError("Can only edit dispatches in DRAFT or PACKED status")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(dispatch, key, value)

        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch_id)

    # ─── Status Transitions ────────────────────────────────────

    @staticmethod
    async def pack_dispatch(db: AsyncSession, dispatch_id: int) -> Dispatch:
        """Mark as PACKED — deducts inventory stock."""
        dispatch = await DispatchService._load_dispatch(db, dispatch_id)

        if DispatchStatus.PACKED not in VALID_TRANSITIONS.get(dispatch.status, []):
            raise ConflictError(f"Cannot pack dispatch in '{dispatch.status.value}' status")

        # Deduct stock for each item
        for d_item in dispatch.items:
            inv_item = await db.get(Item, d_item.product_id)
            if not inv_item:
                raise NotFoundError(f"Inventory item {d_item.product_id} not found")

            available = float(inv_item.current_stock)
            needed = float(d_item.quantity)

            if needed > available:
                raise ConflictError(
                    f"Insufficient stock for '{inv_item.name}' (SKU: {inv_item.sku}). "
                    f"Available: {available}, Required: {needed}"
                )

            inv_item.current_stock = available - needed

            # Update picked/packed quantities
            d_item.picked_quantity = needed
            d_item.packed_quantity = needed

            # Audit trail
            stock_tx = StockTransaction(
                item_id=d_item.product_id,
                transaction_type=TransactionType.OUT,
                quantity=needed,
                reference_id=dispatch.dispatch_number,
                reference_type="dispatch_packed",
                notes=f"Stock deducted for dispatch {dispatch.dispatch_number}",
            )
            db.add(stock_tx)

        dispatch.status = DispatchStatus.PACKED
        
        # Auto-update Sales Order status
        if dispatch.sales_order_id:
            so = await db.get(SalesOrder, dispatch.sales_order_id)
            if so and so.status == OrderStatus.CONFIRMED:
                so.status = OrderStatus.PROCESSING

        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch_id)

    @staticmethod
    async def ship_dispatch(db: AsyncSession, dispatch_id: int, tracking_number: str | None = None, logistics_partner: str | None = None) -> Dispatch:
        """Mark as SHIPPED — requires logistics info."""
        dispatch = await DispatchService._load_dispatch(db, dispatch_id)

        if DispatchStatus.SHIPPED not in VALID_TRANSITIONS.get(dispatch.status, []):
            raise ConflictError(f"Cannot ship dispatch in '{dispatch.status.value}' status")

        if tracking_number:
            dispatch.tracking_number = tracking_number
        if logistics_partner:
            dispatch.logistics_partner = logistics_partner

        dispatch.status = DispatchStatus.SHIPPED
        dispatch.dispatch_date = dispatch.dispatch_date or datetime.now(timezone.utc)
        
        # Auto-update Sales Order status
        if dispatch.sales_order_id:
            so = await db.get(SalesOrder, dispatch.sales_order_id)
            if so and so.status in (OrderStatus.CONFIRMED, OrderStatus.PROCESSING):
                so.status = OrderStatus.SHIPPED

        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch_id)

    @staticmethod
    async def deliver_dispatch(db: AsyncSession, dispatch_id: int) -> Dispatch:
        """Mark as DELIVERED — records delivery date."""
        dispatch = await DispatchService._load_dispatch(db, dispatch_id)

        if DispatchStatus.DELIVERED not in VALID_TRANSITIONS.get(dispatch.status, []):
            raise ConflictError(f"Cannot deliver dispatch in '{dispatch.status.value}' status")

        dispatch.status = DispatchStatus.DELIVERED
        dispatch.delivered_date = datetime.now(timezone.utc)
        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch_id)

    @staticmethod
    async def cancel_dispatch(db: AsyncSession, dispatch_id: int) -> Dispatch:
        """Cancel dispatch — restores inventory if it was packed."""
        dispatch = await DispatchService._load_dispatch(db, dispatch_id)

        if DispatchStatus.CANCELLED not in VALID_TRANSITIONS.get(dispatch.status, []):
            raise ConflictError(f"Cannot cancel dispatch in '{dispatch.status.value}' status")

        # Restore stock if dispatch was packed
        if dispatch.status == DispatchStatus.PACKED:
            for d_item in dispatch.items:
                inv_item = await db.get(Item, d_item.product_id)
                if inv_item:
                    inv_item.current_stock = float(inv_item.current_stock) + float(d_item.quantity)

                    stock_tx = StockTransaction(
                        item_id=d_item.product_id,
                        transaction_type=TransactionType.IN,
                        quantity=float(d_item.quantity),
                        reference_id=dispatch.dispatch_number,
                        reference_type="dispatch_cancelled",
                        notes=f"Stock restored from cancelled dispatch {dispatch.dispatch_number}",
                    )
                    db.add(stock_tx)

        dispatch.status = DispatchStatus.CANCELLED
        await db.flush()
        return await DispatchService._load_dispatch(db, dispatch_id)

    # ─── Dispatchable Sales Orders ──────────────────────────────

    @staticmethod
    async def get_dispatchable_sales_orders(db: AsyncSession) -> list[dict]:
        """Get sales orders that can have dispatches created against them."""
        result = await db.execute(
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item),
                joinedload(SalesOrder.customer),
            )
            .where(SalesOrder.status.in_(DISPATCHABLE_STATUSES))
            .order_by(SalesOrder.id.desc())
        )
        orders = result.unique().scalars().all()

        dispatchable = []
        for order in orders:
            # Get already dispatched quantities for this order
            dispatched_map = await DispatchService._get_dispatched_quantities(db, order.id)

            order_items = []
            has_remaining = False
            for so_item in order.items:
                ordered = float(so_item.quantity)
                already_dispatched = dispatched_map.get(so_item.item_id, 0)
                remaining = ordered - already_dispatched

                inv = so_item.inventory_item
                order_items.append({
                    "item_id": so_item.item_id,
                    "item_name": inv.name if inv else None,
                    "item_sku": inv.sku if inv else None,
                    "item_uom": inv.unit_of_measure if inv else None,
                    "ordered_quantity": ordered,
                    "already_dispatched": already_dispatched,
                    "remaining_quantity": remaining,
                    "available_stock": float(inv.current_stock) if inv else None,
                })
                if remaining > 0:
                    has_remaining = True

            if has_remaining:
                customer = order.customer
                dispatchable.append({
                    "id": order.id,
                    "order_number": order.order_number,
                    "status": order.status.value if hasattr(order.status, 'value') else order.status,
                    "customer_id": order.customer_id,
                    "customer_name": customer.name if customer else None,
                    "total_amount": float(order.total_amount) if order.total_amount else None,
                    "order_date": order.order_date.isoformat() if order.order_date else None,
                    "items": order_items,
                })

        return dispatchable

    @staticmethod
    async def get_production_ready_items(db: AsyncSession) -> list[dict]:
        """Get recently completed production processes that have available finished goods ready for dispatch."""
        from app.modules.production.models import ProductionProcess, ProcessStage, WorkOrder
        from app.modules.sales.models import SalesOrder

        query = (
            select(ProductionProcess)
            .where(ProductionProcess.stage == ProcessStage.COMPLETED)
            .order_by(ProductionProcess.updated_at.desc())
            .limit(50)  # Reasonable limit for the UI dashboard snippet
        )
        result = await db.execute(query)
        processes = result.scalars().all()

        ready_items = []
        for pp in processes:
            # Check stock
            fg_item = await db.get(Item, pp.fg_item_id)
            if not fg_item or float(fg_item.current_stock) <= 0:
                continue

            # Find linked sales order
            linked_sales_order_id = None
            if pp.work_order_id:
                wo = await db.get(WorkOrder, pp.work_order_id)
                if wo and wo.document_number:
                    so_res = await db.execute(select(SalesOrder.id).where(SalesOrder.order_number == wo.document_number))
                    linked_sales_order_id = so_res.scalar_one_or_none()

            ready_items.append({
                "process_id": pp.id,
                "process_number": pp.process_number,
                "fg_item_id": pp.fg_item_id,
                "fg_name": fg_item.name,
                "fg_sku": fg_item.sku,
                "completed_quantity": float(pp.completed_quantity),
                "available_stock": float(fg_item.current_stock),
                "linked_sales_order_id": linked_sales_order_id,
                "completion_date": pp.updated_at.isoformat() if pp.updated_at else None
            })
        return ready_items
