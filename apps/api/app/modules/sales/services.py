"""
Sales Services — Business logic for the Sales Order module.
"""
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

        # Calculate totals from items
        total_before_tax = 0.0
        total_tax = 0.0
        total_discount = 0.0

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

        for item_data in data.items:
            # Validate inventory item exists
            inv_item = await db.get(Item, item_data.item_id)
            if not inv_item:
                raise NotFoundError(f"Inventory item {item_data.item_id} not found")

            subtotal, total_price = _calculate_line(
                item_data.quantity, item_data.unit_price,
                item_data.discount, item_data.tax_rate
            )
            gross = item_data.quantity * item_data.unit_price
            discount_amt = gross - subtotal
            tax_amt = total_price - subtotal

            total_before_tax += subtotal
            total_tax += tax_amt
            total_discount += discount_amt

            so_item = SalesOrderItem(
                sales_order_id=order.id,
                item_id=item_data.item_id,
                description=item_data.description or inv_item.name,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                discount=item_data.discount,
                tax_rate=item_data.tax_rate,
                subtotal=subtotal,
                total_price=total_price,
            )
            db.add(so_item)

        extra_charges_total = 0.0
        extra_charges_tax = 0.0
        if data.extra_charges:
            for charge in data.extra_charges:
                amount = float(charge.get("amount", 0))
                tax_rate = float(charge.get("tax_rate", 0))
                extra_charges_total += amount
                extra_charges_tax += amount * (tax_rate / 100)

        order.total_amount = round(total_before_tax + total_tax + extra_charges_total + extra_charges_tax, 2)
        order.tax_amount = round(total_tax + extra_charges_tax, 2)
        order.discount_amount = round(total_discount, 2)

        await db.flush()

        # Reload with relationships
        result = await db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item))
            .options(joinedload(SalesOrder.customer))
            .where(SalesOrder.id == order.id)
        )
        return result.scalar_one()

    @staticmethod
    async def get_order(db: AsyncSession, order_id: int) -> SalesOrder:
        result = await db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items).joinedload(SalesOrderItem.inventory_item))
            .options(joinedload(SalesOrder.customer))
            .where(SalesOrder.id == order_id)
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

        # Update items if provided
        if data.items is not None:
            # Remove old items
            for old_item in order.items:
                await db.delete(old_item)
            await db.flush()

            total_before_tax = 0.0
            total_tax = 0.0
            total_discount = 0.0

            for item_data in data.items:
                inv_item = await db.get(Item, item_data.item_id)
                if not inv_item:
                    raise NotFoundError(f"Inventory item {item_data.item_id} not found")

                subtotal, total_price = _calculate_line(
                    item_data.quantity, item_data.unit_price,
                    item_data.discount, item_data.tax_rate
                )
                gross = item_data.quantity * item_data.unit_price
                discount_amt = gross - subtotal
                tax_amt = total_price - subtotal

                total_before_tax += subtotal
                total_tax += tax_amt
                total_discount += discount_amt

                so_item = SalesOrderItem(
                    sales_order_id=order.id,
                    item_id=item_data.item_id,
                    description=item_data.description or inv_item.name,
                    quantity=item_data.quantity,
                    unit_price=item_data.unit_price,
                    discount=item_data.discount,
                    tax_rate=item_data.tax_rate,
                    subtotal=subtotal,
                    total_price=total_price,
                )
                db.add(so_item)

            extra_charges_list = data.extra_charges if data.extra_charges is not None else order.extra_charges
            extra_charges_total = 0.0
            extra_charges_tax = 0.0
            if extra_charges_list:
                for charge in extra_charges_list:
                    amount = float(charge.get("amount", 0))
                    tax_rate = float(charge.get("tax_rate", 0))
                    extra_charges_total += amount
                    extra_charges_tax += amount * (tax_rate / 100)

            order.total_amount = round(total_before_tax + total_tax + extra_charges_total + extra_charges_tax, 2)
            order.tax_amount = round(total_tax + extra_charges_tax, 2)
            order.discount_amount = round(total_discount, 2)

        await db.flush()

        # Reload
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def confirm_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to CONFIRMED — reserves inventory stock."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.CONFIRMED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot confirm order in '{order.status.value}' status. "
                f"Valid transitions: {[s.value for s in VALID_TRANSITIONS.get(order.status, [])]}"
            )

        # Reserve stock for each item
        for so_item in order.items:
            inv_item = await db.get(Item, so_item.item_id)
            if not inv_item:
                raise NotFoundError(f"Inventory item {so_item.item_id} not found")

            available = float(inv_item.current_stock)
            needed = float(so_item.quantity)

            if needed > available:
                raise ConflictError(
                    f"Insufficient stock for '{inv_item.name}' (SKU: {inv_item.sku}). "
                    f"Available: {available}, Requested: {needed}"
                )

            # Reserve stock (reduce available)
            inv_item.current_stock = available - needed

            # Audit trail
            stock_tx = StockTransaction(
                item_id=so_item.item_id,
                transaction_type=TransactionType.OUT,
                quantity=needed,
                reference_id=order.order_number,
                reference_type="sales_order_reserved",
                notes=f"Stock reserved for SO {order.order_number}",
            )
            db.add(stock_tx)

        order.status = OrderStatus.CONFIRMED
        await db.flush()
        return await SalesService.get_order(db, order_id)

    @staticmethod
    async def ship_order(db: AsyncSession, order_id: int) -> SalesOrder:
        """Transition to SHIPPED — stock already reserved at confirm."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.SHIPPED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot ship order in '{order.status.value}' status"
            )

        # Create dispatch record audit trail
        for so_item in order.items:
            stock_tx = StockTransaction(
                item_id=so_item.item_id,
                transaction_type=TransactionType.OUT,
                quantity=float(so_item.quantity),
                reference_id=order.order_number,
                reference_type="sales_order_shipped",
                notes=f"Stock dispatched for SO {order.order_number}",
            )
            db.add(stock_tx)

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
        """Cancel order — releases reserved stock if it was confirmed."""
        order = await SalesService.get_order(db, order_id)

        if OrderStatus.CANCELLED not in VALID_TRANSITIONS.get(order.status, []):
            raise ConflictError(
                f"Cannot cancel order in '{order.status.value}' status"
            )

        # If order was confirmed or processing, release reserved stock
        if order.status in (OrderStatus.CONFIRMED, OrderStatus.PROCESSING):
            for so_item in order.items:
                inv_item = await db.get(Item, so_item.item_id)
                if inv_item:
                    inv_item.current_stock = float(inv_item.current_stock) + float(so_item.quantity)

                    stock_tx = StockTransaction(
                        item_id=so_item.item_id,
                        transaction_type=TransactionType.IN,
                        quantity=float(so_item.quantity),
                        reference_id=order.order_number,
                        reference_type="sales_order_cancelled",
                        notes=f"Stock released from cancelled SO {order.order_number}",
                    )
                    db.add(stock_tx)

        order.status = OrderStatus.CANCELLED
        await db.flush()
        return await SalesService.get_order(db, order_id)
