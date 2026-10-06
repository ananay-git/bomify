"""
Sales Services — Business logic for the Sales Order module.
"""
from collections import defaultdict
from typing import Sequence
from datetime import datetime, timezone
from sqlalchemy import select, func, or_, extract
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.sales.models import SalesOrder, SalesOrderItem, OrderStatus
from app.modules.sales.schemas import SalesOrderCreate, SalesOrderUpdate, SalesOrderItemResponse
from app.modules.inventory.models import Item, StockTransaction, TransactionType
from app.modules.parties.models import Party
from app.core.exceptions import NotFoundError, ConflictError

# Stock model: inventory moves only when goods physically leave (dispatch packed,
# or a direct ship). Confirming an order commits stock without moving it.
OPEN_ORDER_STATUSES = (OrderStatus.CONFIRMED, OrderStatus.PROCESSING)

# Valid status transitions
VALID_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.DRAFT: [OrderStatus.QUOTATION_SENT, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.QUOTATION_SENT: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    OrderStatus.PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    OrderStatus.SHIPPED: [OrderStatus.INVOICED],
    OrderStatus.INVOICED: [OrderStatus.PAID],
    OrderStatus.PAID: [],
    OrderStatus.CANCELLED: [],
}


def _calculate_line(qty: float, price: float, discount: float, tax_rate: float) -> tuple[float, float]:
    """Returns (subtotal_after_discount, total_with_tax)."""
    gross = qty * price
    after_discount = gross * (1 - (discount or 0) / 100)
    tax = after_discount * ((tax_rate or 0) / 100)
    return round(after_discount, 2), round(after_discount + tax, 2)


def _enrich_item_response(item: SalesOrderItem) -> dict:
    """Enrich a SalesOrderItem with inventory data for the response."""
    data = {
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
    if item.inventory_item:
        inv = item.inventory_item
        data["item_name"] = inv.name
        data["item_sku"] = inv.sku
        data["item_hsn"] = inv.hsn_code
        data["item_uom"] = inv.unit_of_measure
        data["available_stock"] = float(inv.current_stock)
    return data


def _active_dispatch_statuses():
    from app.modules.dispatch.models import DispatchStatus
    return (DispatchStatus.PACKED, DispatchStatus.SHIPPED, DispatchStatus.DELIVERED)


async def committed_quantities(
    db: AsyncSession, item_ids: list[int], exclude_order_id: int | None = None
) -> dict[int, float]:
    """Stock promised to open (confirmed/processing) orders that has not left yet."""
    from app.modules.dispatch.models import Dispatch, DispatchItem

    if not item_ids:
        return {}
    q = (
        select(SalesOrderItem.sales_order_id, SalesOrderItem.item_id, func.sum(SalesOrderItem.quantity))
        .join(SalesOrder, SalesOrder.id == SalesOrderItem.sales_order_id)
        .where(SalesOrder.status.in_(OPEN_ORDER_STATUSES), SalesOrderItem.item_id.in_(item_ids))
        .group_by(SalesOrderItem.sales_order_id, SalesOrderItem.item_id)
    )
    if exclude_order_id is not None:
        q = q.where(SalesOrder.id != exclude_order_id)
    ordered = {(so, it): float(qty) for so, it, qty in (await db.execute(q)).all()}
    if not ordered:
        return {}

    moved_rows = await db.execute(
        select(Dispatch.sales_order_id, DispatchItem.product_id, func.sum(DispatchItem.quantity))
        .join(Dispatch, Dispatch.id == DispatchItem.dispatch_id)
        .where(
            Dispatch.sales_order_id.in_({so for so, _ in ordered}),
            Dispatch.status.in_(_active_dispatch_statuses()),
            DispatchItem.product_id.in_(item_ids),
        )
        .group_by(Dispatch.sales_order_id, DispatchItem.product_id)
    )
    moved = {(so, it): float(qty) for so, it, qty in moved_rows.all()}

    committed: dict[int, float] = defaultdict(float)
    for key, qty in ordered.items():
        committed[key[1]] += max(0.0, qty - moved.get(key, 0.0))
    return dict(committed)


def _apply_totals(order: SalesOrder, lines: list[SalesOrderItem], extra_charges: list | None) -> None:
    """Recompute order totals from its line items and extra charges."""
    total_before_tax = sum(float(l.subtotal or 0) for l in lines)
    total_tax = sum(float(l.total_price) - float(l.subtotal or 0) for l in lines)
    total_discount = sum(float(l.quantity) * float(l.unit_price) - float(l.subtotal or 0) for l in lines)

    extra_total = extra_tax = 0.0
    for charge in extra_charges or []:
        amount = float(charge.get("amount", 0) or 0)
        extra_total += amount
        extra_tax += amount * (float(charge.get("tax_rate", 0) or 0) / 100)

    order.total_amount = round(total_before_tax + total_tax + extra_total + extra_tax, 2)
    order.tax_amount = round(total_tax + extra_tax, 2)
    order.discount_amount = round(total_discount, 2)


async def _build_lines(db: AsyncSession, order_id: int, items_data) -> list[SalesOrderItem]:
    lines = []
    for item_data in items_data:
        inv_item = await db.get(Item, item_data.item_id)
        if not inv_item:
            raise NotFoundError(f"Inventory item {item_data.item_id} not found")
        subtotal, total_price = _calculate_line(
            item_data.quantity, item_data.unit_price, item_data.discount, item_data.tax_rate
        )
        line = SalesOrderItem(
            sales_order_id=order_id,
            item_id=item_data.item_id,
            description=item_data.description or inv_item.name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            discount=item_data.discount,
            tax_rate=item_data.tax_rate,
            subtotal=subtotal,
            total_price=total_price,
        )
        db.add(line)
        lines.append(line)
    return lines


class SalesService:

    @staticmethod
    async def _generate_order_number(db: AsyncSession) -> str:
        """Generate sequential order number like SO-2026-0001."""
        year = datetime.now(timezone.utc).year
        prefix = f"SO-{year}-"

        result = await db.execute(
            select(SalesOrder.order_number)
            .where(SalesOrder.order_number.like(f"{prefix}%"))
            .order_by(SalesOrder.id.desc())
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
        return await SalesService._generate_order_number(db)

    @staticmethod
    async def create_order(db: AsyncSession, data: SalesOrderCreate) -> SalesOrder:
        # Validate customer exists
        customer = await db.get(Party, data.customer_id)
        if not customer:
            raise NotFoundError("Customer not found")

        order_number = await SalesService._generate_order_number(db)

        # Check for duplicate
        existing = await db.execute(
            select(SalesOrder).where(SalesOrder.order_number == order_number)
        )
        if existing.scalar_one_or_none():
            raise ConflictError("SalesOrder with this number already exists")

        order = SalesOrder(
            order_number=order_number,
            customer_id=data.customer_id,
            expected_delivery_date=data.expected_delivery_date,
            payment_terms=data.payment_terms,
            billing_address=data.billing_address,
            shipping_address=data.shipping_address,
            notes=data.notes,
            status=OrderStatus.DRAFT,
            # Document tab fields
            extra_charges=data.extra_charges,
            terms_conditions=data.terms_conditions,
            comments=data.comments,
            additional_details=data.additional_details,
            signature_data=data.signature_data,
            attachments=data.attachments,
        )
        db.add(order)
        await db.flush()

        lines = await _build_lines(db, order.id, data.items)
        _apply_totals(order, lines, data.extra_charges)
        await db.flush()

        return await SalesService.get_order(db, order.id)

    @staticmethod
    async def get_order(db: AsyncSession, order_id: int) -> SalesOrder:
        result = await db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item))
            .options(joinedload(SalesOrder.customer))
            .where(SalesOrder.id == order_id)
            # Refresh objects already in the session so edited items/totals are current.
            .execution_options(populate_existing=True)
        )
        order = result.unique().scalar_one_or_none()
        if not order:
            raise NotFoundError("Sales order not found")
        return order

    @staticmethod
    async def list_orders(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
        search: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> tuple[Sequence[SalesOrder], int]:
        query = (
            select(SalesOrder)
            .options(selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item))
            .options(joinedload(SalesOrder.customer))
        )
        count_query = select(func.count(SalesOrder.id))

        # Filter by status
        if status and status != "all":
            try:
                status_enum = OrderStatus(status)
                query = query.where(SalesOrder.status == status_enum)
                count_query = count_query.where(SalesOrder.status == status_enum)
            except ValueError:
                pass

        # Search by order number or customer name
        if search:
            search_term = f"%{search}%"
            query = query.outerjoin(Party, SalesOrder.customer_id == Party.id).where(
                or_(
                    SalesOrder.order_number.ilike(search_term),
                    Party.name.ilike(search_term),
                )
            )
            count_query = count_query.outerjoin(Party, SalesOrder.customer_id == Party.id).where(
                or_(
                    SalesOrder.order_number.ilike(search_term),
                    Party.name.ilike(search_term),
                )
            )

        # Date range filter
        if date_from:
            try:
                from_dt = datetime.fromisoformat(date_from)
                query = query.where(SalesOrder.order_date >= from_dt)
                count_query = count_query.where(SalesOrder.order_date >= from_dt)
            except ValueError:
                pass
        if date_to:
            try:
                to_dt = datetime.fromisoformat(date_to)
                query = query.where(SalesOrder.order_date <= to_dt)
                count_query = count_query.where(SalesOrder.order_date <= to_dt)
            except ValueError:
                pass

        query = query.order_by(SalesOrder.id.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        orders = result.unique().scalars().all()

        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        return orders, total

    @staticmethod
    async def update_order(db: AsyncSession, order_id: int, data: SalesOrderUpdate) -> SalesOrder:
        order = await SalesService.get_order(db, order_id)

        # Only allow editing DRAFT orders
        if order.status not in (OrderStatus.DRAFT, OrderStatus.QUOTATION_SENT):
            raise ConflictError("Can only edit orders in DRAFT or QUOTATION_SENT status")

        if data.customer_id is not None:
            customer = await db.get(Party, data.customer_id)
            if not customer:
                raise NotFoundError("Customer not found")
            order.customer_id = data.customer_id

        if data.expected_delivery_date is not None:
            order.expected_delivery_date = data.expected_delivery_date
        if data.payment_terms is not None:
            order.payment_terms = data.payment_terms
        if data.billing_address is not None:
            order.billing_address = data.billing_address
        if data.shipping_address is not None:
            order.shipping_address = data.shipping_address
        if data.notes is not None:
            order.notes = data.notes
        # Document tab fields
        if data.extra_charges is not None:
            order.extra_charges = data.extra_charges
        if data.terms_conditions is not None:
            order.terms_conditions = data.terms_conditions
        if data.comments is not None:
            order.comments = data.comments
        if data.additional_details is not None:
            order.additional_details = data.additional_details
        if data.signature_data is not None:
            order.signature_data = data.signature_data
        if data.attachments is not None:
            order.attachments = data.attachments

        # Update items if provided; totals follow items and extra charges.
        if data.items is not None:
            if not data.items:
                raise ConflictError("A sales order needs at least one item")
            for old_item in list(order.items):
                order.items.remove(old_item)
            await db.flush()
            lines = await _build_lines(db, order.id, data.items)
            _apply_totals(order, lines, order.extra_charges)
        elif data.extra_charges is not None:
            _apply_totals(order, list(order.items), order.extra_charges)

        await db.flush()

        # Reload
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def confirm_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to CONFIRMED — commits stock against other open orders.

        Stock is not deducted here; it leaves inventory when the goods are packed
        for dispatch (or shipped directly). Deducting at both points double-counts.
        """
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.CONFIRMED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot confirm order in '{order.status.value}' status. "
                f"Valid transitions: {[s.value for s in VALID_TRANSITIONS.get(order.status, [])]}"
            )

        needed: dict[int, float] = defaultdict(float)
        for so_item in order.items:
            needed[so_item.item_id] += float(so_item.quantity)
        committed = await committed_quantities(db, list(needed), exclude_order_id=order.id)

        for item_id, qty in needed.items():
            inv_item = await db.get(Item, item_id)
            if not inv_item:
                raise NotFoundError(f"Inventory item {item_id} not found")
            available = float(inv_item.current_stock) - committed.get(item_id, 0.0)
            if qty > available + 1e-9:
                raise ConflictError(
                    f"Insufficient stock for '{inv_item.name}' (SKU: {inv_item.sku}). "
                    f"Available: {max(available, 0.0)}, Requested: {qty}"
                    + (f" ({committed[item_id]} already committed to other open orders)"
                       if committed.get(item_id) else "")
                )

        order.status = OrderStatus.CONFIRMED
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def ship_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to SHIPPED ("Mark Shipped"): ship everything still outstanding.

        Packed dispatches are marked shipped (their stock already left), draft
        dispatches are cancelled (they never touched stock), and any quantity not
        covered by a dispatch is deducted from stock here — exactly once.
        """
        from app.modules.dispatch.models import Dispatch, DispatchStatus

        order = await SalesService.get_order(db, order_id)

        if OrderStatus.SHIPPED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot ship order in '{order.status.value}' status"
            )

        dispatches = (await db.execute(
            select(Dispatch).options(selectinload(Dispatch.items))
            .where(Dispatch.sales_order_id == order.id, Dispatch.status != DispatchStatus.CANCELLED)
        )).unique().scalars().all()

        needed: dict[int, float] = defaultdict(float)
        for so_item in order.items:
            needed[so_item.item_id] += float(so_item.quantity)
        for d in dispatches:
            if d.status == DispatchStatus.DRAFT:
                d.status = DispatchStatus.CANCELLED
                continue
            if d.status == DispatchStatus.PACKED:
                d.status = DispatchStatus.SHIPPED
                d.dispatch_date = d.dispatch_date or datetime.now(timezone.utc)
            for d_item in d.items:
                needed[d_item.product_id] -= float(d_item.quantity)

        for item_id, qty in needed.items():
            if qty <= 1e-9:
                continue
            inv_item = (await db.execute(
                select(Item).where(Item.id == item_id).with_for_update()
            )).scalar_one_or_none()
            if not inv_item:
                raise NotFoundError(f"Inventory item {item_id} not found")
            if qty > float(inv_item.current_stock) + 1e-9:
                raise ConflictError(
                    f"Insufficient stock for '{inv_item.name}' (SKU: {inv_item.sku}). "
                    f"Available: {float(inv_item.current_stock)}, Required: {qty}"
                )
            inv_item.current_stock = float(inv_item.current_stock) - qty
            db.add(StockTransaction(
                item_id=item_id,
                transaction_type=TransactionType.OUT,
                quantity=qty,
                reference_id=order.order_number,
                reference_type="sales_order_shipped",
                notes=f"Stock shipped for SO {order.order_number}",
            ))

        order.status = OrderStatus.SHIPPED
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def process_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to PROCESSING."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.PROCESSING not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot process order in '{order.status.value}' status"
            )

        order.status = OrderStatus.PROCESSING
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def invoice_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to INVOICED — creates Accounts Receivable entry (placeholder)."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.INVOICED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot invoice order in '{order.status.value}' status"
            )

        order.status = OrderStatus.INVOICED
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def mark_paid(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to PAID."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.PAID not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot mark order as paid in '{order.status.value}' status"
            )

        order.status = OrderStatus.PAID
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def cancel_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Cancel order. Blocked while goods are packed or shipped against it;
        draft dispatches (which never touched stock) are cancelled with it."""
        from app.modules.dispatch.models import Dispatch, DispatchStatus

        order = await SalesService.get_order(db, order_id)

        if OrderStatus.CANCELLED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot cancel order in '{order.status.value}' status"
            )

        dispatches = (await db.execute(
            select(Dispatch).where(
                Dispatch.sales_order_id == order.id,
                Dispatch.status != DispatchStatus.CANCELLED,
            )
        )).unique().scalars().all()
        active = [d.dispatch_number for d in dispatches if d.status != DispatchStatus.DRAFT]
        if active:
            raise ConflictError(
                f"Cannot cancel order {order.order_number}: goods are already packed/shipped "
                f"in {', '.join(active)}. Cancel those dispatches first."
            )
        for d in dispatches:
            d.status = DispatchStatus.CANCELLED

        order.status = OrderStatus.CANCELLED
        await db.flush()
        return await SalesService.get_order(db, order_id)
