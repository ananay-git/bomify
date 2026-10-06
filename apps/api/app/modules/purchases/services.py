"""
Purchases Services — Cross-module integration with Inventory, Sales, Dispatch, and Production.
"""
from typing import Sequence
from datetime import datetime, timezone
from sqlalchemy import select, func, or_, case, extract
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.purchases.models import (
    PurchaseOrder, POItem, GRN, GRNItem,
    POStatus, PaymentStatus, InvoiceStatus, GoodsStatus, DocumentType,
)
from app.modules.purchases.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, GRNCreate
from app.modules.inventory.models import Item, StockTransaction, TransactionType
from app.modules.parties.models import Party
from app.core.exceptions import NotFoundError, ConflictError


# ─── Helpers ───────────────────────────────────────────────────────

def _infer_document_type(po_number: str) -> DocumentType:
    """Infer document type from the po_number prefix for backward compatibility."""
    prefix_map = {
        "OC-": DocumentType.ORDER_CONFIRMATION,
        "SC-": DocumentType.SERVICE_CONFIRMATION,
        "INV-": DocumentType.INVOICE,
        "ADOC-": DocumentType.ADHOC_INVOICE,
        "SO-": DocumentType.SERVICE_ORDER,
    }
    for prefix, doc_type in prefix_map.items():
        if po_number.startswith(prefix):
            return doc_type
    return DocumentType.PURCHASE_ORDER


def _serialize_po(po: PurchaseOrder) -> dict:
    """Enrich a PurchaseOrder ORM object with computed fields for response."""
    # Default document_type to PURCHASE_ORDER if column is NULL (pre-migration rows)
    doc_type = getattr(po, 'document_type', None) or DocumentType.PURCHASE_ORDER
    linked_so_id = getattr(po, 'linked_sales_order_id', None)
    linked_so = getattr(po, 'linked_sales_order', None)
    data = {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_id": po.supplier_id,
        "supplier_name": po.supplier.name if po.supplier else None,
        "document_type": doc_type,
        "linked_sales_order_id": linked_so_id,
        "linked_sales_order_number": (
            linked_so.order_number if linked_so else None
        ),
        "billing_location_id": po.billing_location_id,
        "delivery_location_id": po.delivery_location_id,
        "status": po.status,
        "payment_status": po.payment_status,
        "invoice_status": po.invoice_status,
        "goods_status": po.goods_status,
        "order_date": po.order_date,
        "expected_delivery_date": po.expected_delivery_date,
        "total_amount": float(po.total_amount) if po.total_amount else 0,
        "notes": po.notes,
        # Document tab fields
        "extra_charges": po.extra_charges,
        "terms_conditions": po.terms_conditions,
        "comments": po.comments,
        "additional_details": po.additional_details,
        "signature_data": po.signature_data,
        "attachments": po.attachments,
        "created_at": po.created_at,
        "updated_at": po.updated_at,
        "items": [
            {
                "id": item.id,
                "item_id": item.item_id,
                "ordered_quantity": float(item.ordered_quantity),
                "received_quantity": float(item.received_quantity),
                "unit_price": float(item.unit_price),
            }
            for item in po.items
        ],
    }
    return data


class PurchasesService:

    # ─── Load helper ───────────────────────────────────────────

    @staticmethod
    async def _load_po(db: AsyncSession, po_id: int) -> PurchaseOrder:
        """Load PO with all relationships for serialization."""
        result = await db.execute(
            select(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items),
                joinedload(PurchaseOrder.supplier),
                joinedload(PurchaseOrder.linked_sales_order),
            )
            .where(PurchaseOrder.id == po_id)
        )
        po = result.unique().scalar_one_or_none()
        if not po:
            raise NotFoundError("Purchase order not found")
        return po

    # ─── Create ────────────────────────────────────────────────

    @staticmethod
    async def create_po(db: AsyncSession, data: PurchaseOrderCreate) -> dict:
        existing = await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.po_number == data.po_number)
        )
        if existing.scalar_one_or_none():
            raise ConflictError("PO with this number already exists")

        # Determine document type
        doc_type = data.document_type or _infer_document_type(data.po_number)

        # Validate linked Sales Order if provided
        if data.linked_sales_order_id:
            from app.modules.sales.models import SalesOrder
            so = await db.get(SalesOrder, data.linked_sales_order_id)
            if not so:
                raise NotFoundError(f"Linked Sales Order #{data.linked_sales_order_id} not found")

        total = sum(item.ordered_quantity * item.unit_price for item in data.items)
        if data.extra_charges:
            for charge in data.extra_charges:
                amount = float(charge.get("amount", 0))
                tax_rate = float(charge.get("tax_rate", 0))
                total += amount + (amount * (tax_rate / 100))

        po = PurchaseOrder(
            po_number=data.po_number,
            supplier_id=data.supplier_id,
            document_type=doc_type,
            linked_sales_order_id=data.linked_sales_order_id,
            status=data.status or POStatus.DRAFT,
            billing_location_id=data.billing_location_id,
            delivery_location_id=data.delivery_location_id,
            expected_delivery_date=data.expected_delivery_date,
            notes=data.notes,
            total_amount=total,
            invoice_status=InvoiceStatus.PENDING,
            goods_status=GoodsStatus.NOT_RECEIVED,
            # Document tab fields
            extra_charges=data.extra_charges,
            terms_conditions=data.terms_conditions,
            comments=data.comments,
            additional_details=data.additional_details,
            signature_data=data.signature_data,
            attachments=data.attachments,
        )
        db.add(po)
        await db.flush()

        for item_data in data.items:
            po_item = POItem(
                po_id=po.id,
                item_id=item_data.item_id,
                ordered_quantity=item_data.ordered_quantity,
                unit_price=item_data.unit_price,
            )
            db.add(po_item)

        await db.flush()
        po = await PurchasesService._load_po(db, po.id)
        return _serialize_po(po)

    # ─── Get / List ────────────────────────────────────────────

    @staticmethod
    async def get_po(db: AsyncSession, po_id: int) -> dict:
        po = await PurchasesService._load_po(db, po_id)
        return _serialize_po(po)

    @staticmethod
    async def list_pos(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        document_type: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> tuple[list[dict], int]:
        query = (
            select(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items),
                joinedload(PurchaseOrder.supplier),
                joinedload(PurchaseOrder.linked_sales_order),
            )
        )
        count_query = select(func.count(PurchaseOrder.id))

        # Filter by document_type
        if document_type and document_type != "all":
            try:
                dt = DocumentType(document_type)
                query = query.where(PurchaseOrder.document_type == dt)
                count_query = count_query.where(PurchaseOrder.document_type == dt)
            except ValueError:
                pass

        # Filter by status
        if status and status != "all":
            try:
                st = POStatus(status)
                query = query.where(PurchaseOrder.status == st)
                count_query = count_query.where(PurchaseOrder.status == st)
            except ValueError:
                pass

        # Search by PO number or supplier name
        if search:
            search_term = f"%{search}%"
            query = query.outerjoin(Party, PurchaseOrder.supplier_id == Party.id).where(
                or_(
                    PurchaseOrder.po_number.ilike(search_term),
                    Party.name.ilike(search_term),
                )
            )
            count_query = count_query.outerjoin(Party, PurchaseOrder.supplier_id == Party.id).where(
                or_(
                    PurchaseOrder.po_number.ilike(search_term),
                    Party.name.ilike(search_term),
                )
            )

        query = query.order_by(PurchaseOrder.id.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        pos = result.unique().scalars().all()

        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        return [_serialize_po(po) for po in pos], total

    # ─── Update ────────────────────────────────────────────────

    @staticmethod
    async def update_po(db: AsyncSession, po_id: int, data: PurchaseOrderUpdate) -> dict:
        po = await PurchasesService._load_po(db, po_id)
        old_status = po.status

        # Prevent editing completed POs (except status change to cancelled)
        if po.status == POStatus.COMPLETED and data.status != POStatus.CANCELLED:
            if data.items or data.notes is not None or data.expected_delivery_date:
                raise ConflictError("Cannot edit a completed Purchase Order")

        if data.status:
            po.status = data.status
        if data.payment_status:
            po.payment_status = data.payment_status
        if data.invoice_status:
            po.invoice_status = data.invoice_status
        if data.goods_status:
            po.goods_status = data.goods_status
        if data.document_type:
            po.document_type = data.document_type
        if data.linked_sales_order_id is not None:
            po.linked_sales_order_id = data.linked_sales_order_id
        if data.billing_location_id is not None:
            po.billing_location_id = data.billing_location_id
        if data.delivery_location_id is not None:
            po.delivery_location_id = data.delivery_location_id
        if data.expected_delivery_date:
            po.expected_delivery_date = data.expected_delivery_date
        if data.notes is not None:
            po.notes = data.notes
        # Document tab fields
        if data.extra_charges is not None:
            po.extra_charges = data.extra_charges
        if data.terms_conditions is not None:
            po.terms_conditions = data.terms_conditions
        if data.comments is not None:
            po.comments = data.comments
        if data.additional_details is not None:
            po.additional_details = data.additional_details
        if data.signature_data is not None:
            po.signature_data = data.signature_data
        if data.attachments is not None:
            po.attachments = data.attachments

        # Handle item updates
        if data.items is not None:
            for existing_item in po.items:
                await db.delete(existing_item)
            await db.flush()

            total = 0.0
            for item_data in data.items:
                po_item = POItem(
                    po_id=po.id,
                    item_id=item_data.item_id,
                    ordered_quantity=item_data.ordered_quantity,
                    unit_price=item_data.unit_price,
                )
                db.add(po_item)
                total += item_data.ordered_quantity * item_data.unit_price
            
            extra_charges_list = data.extra_charges if data.extra_charges is not None else po.extra_charges
            if extra_charges_list:
                for charge in extra_charges_list:
                    amount = float(charge.get("amount", 0))
                    tax_rate = float(charge.get("tax_rate", 0))
                    total += amount + (amount * (tax_rate / 100))
                    
            po.total_amount = total
            await db.flush()

        await db.flush()
        po = await PurchasesService._load_po(db, po_id)
        return _serialize_po(po)

    # ─── Cancel PO (with inventory rollback) ────────────────────

    @staticmethod
    async def cancel_po(db: AsyncSession, po_id: int) -> dict:
        """Cancel a PO. If goods were received, reverse inventory adjustments."""
        po = await PurchasesService._load_po(db, po_id)

        if po.status == POStatus.CANCELLED:
            raise ConflictError("Purchase order is already cancelled")
        if po.status == POStatus.COMPLETED:
            raise ConflictError("Cannot cancel a completed purchase order")

        # If goods were received, reverse inventory
        if po.goods_status == GoodsStatus.RECEIVED:
            for po_item in po.items:
                received = float(po_item.received_quantity)
                if received > 0:
                    inv_item = await db.get(Item, po_item.item_id)
                    if inv_item:
                        inv_item.current_stock = max(0, float(inv_item.current_stock) - received)
                        stock_tx = StockTransaction(
                            item_id=po_item.item_id,
                            transaction_type=TransactionType.OUT,
                            quantity=received,
                            reference_id=po.po_number,
                            reference_type="purchase_cancelled",
                            notes=f"Stock reversed from cancelled PO {po.po_number}",
                        )
                        db.add(stock_tx)

        po.status = POStatus.CANCELLED
        await db.flush()
        po = await PurchasesService._load_po(db, po_id)
        return _serialize_po(po)

    # ─── GRN / Inward ──────────────────────────────────────────

    @staticmethod
    async def create_grn(db: AsyncSession, data: GRNCreate) -> GRN:
        po = await PurchasesService._load_po(db, data.po_id)

        grn = GRN(
            po_id=data.po_id,
            grn_number=data.grn_number,
            delivery_date=data.delivery_date,
            notes=data.notes,
        )
        db.add(grn)
        await db.flush()

        all_fully_received = True

        for item_data in data.items:
            grn_item = GRNItem(
                grn_id=grn.id,
                item_id=item_data.item_id,
                received_quantity=item_data.received_quantity,
                accepted_quantity=item_data.accepted_quantity,
                rejected_quantity=item_data.rejected_quantity,
            )
            db.add(grn_item)

            # Update the received_quantity on the PO item
            for po_item in po.items:
                if po_item.item_id == item_data.item_id:
                    po_item.received_quantity = float(po_item.received_quantity) + item_data.received_quantity
                    # Check if fully received
                    if float(po_item.received_quantity) < float(po_item.ordered_quantity):
                        all_fully_received = False
                    break
            else:
                all_fully_received = False

            # Update inventory and create stock transaction
            inv_item = await db.get(Item, item_data.item_id)
            if inv_item and item_data.accepted_quantity > 0:
                inv_item.current_stock = float(inv_item.current_stock) + float(item_data.accepted_quantity)
                stock_tx = StockTransaction(
                    item_id=item_data.item_id,
                    transaction_type=TransactionType.IN,
                    quantity=float(item_data.accepted_quantity),
                    reference_id=data.grn_number,
                    reference_type="inward_document",
                    notes=f"Stock received from Inward {data.grn_number} (PO: {po.po_number})",
                )
                db.add(stock_tx)

        # Auto-update PO status based on receipt
        po.goods_status = GoodsStatus.RECEIVED
        if all_fully_received:
            po.status = POStatus.COMPLETED
        elif po.status == POStatus.SENT:
            po.status = POStatus.PARTIAL

        await db.flush()

        # Reload GRN
        result = await db.execute(
            select(GRN).options(selectinload(GRN.items)).where(GRN.id == grn.id)
        )
        return result.scalar_one()

    @staticmethod
    async def get_grn(db: AsyncSession, grn_id: int) -> GRN:
        result = await db.execute(
            select(GRN).options(selectinload(GRN.items)).where(GRN.id == grn_id)
        )
        grn = result.scalar_one_or_none()
        if not grn:
            raise NotFoundError("Inward document not found")
        return grn

    @staticmethod
    async def list_grns_by_po(db: AsyncSession, po_id: int) -> list[GRN]:
        result = await db.execute(
            select(GRN)
            .options(selectinload(GRN.items))
            .where(GRN.po_id == po_id)
            .order_by(GRN.created_at.desc())
        )
        return list(result.scalars().all())

    # ─── Purchase Statistics (for Dashboard) ────────────────────

    @staticmethod
    async def get_stats(db: AsyncSession) -> dict:
        """Return aggregate purchase statistics for the dashboard."""
        now = datetime.now(timezone.utc)

        # Total counts and value
        total_res = await db.execute(select(func.count(PurchaseOrder.id)))
        total_orders = total_res.scalar_one()

        value_res = await db.execute(
            select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        )
        total_value = float(value_res.scalar_one())

        # Count by status
        status_res = await db.execute(
            select(PurchaseOrder.status, func.count(PurchaseOrder.id))
            .group_by(PurchaseOrder.status)
        )
        status_counts = {row[0].value: row[1] for row in status_res.all()}

        # Count by document type (wrapped in try/except for resilience)
        type_counts = {}
        try:
            type_res = await db.execute(
                select(PurchaseOrder.document_type, func.count(PurchaseOrder.id))
                .group_by(PurchaseOrder.document_type)
            )
            for row in type_res.all():
                key = row[0].value if row[0] else "purchase_order"
                type_counts[key] = row[1]
        except Exception:
            # Column may not exist yet if migration hasn't run
            type_counts = {}

        # Pending deliveries (sent but not received)
        pending_res = await db.execute(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.status.in_([POStatus.SENT, POStatus.PARTIAL]),
                PurchaseOrder.goods_status == GoodsStatus.NOT_RECEIVED,
            )
        )
        pending_deliveries = pending_res.scalar_one()

        # Overdue deliveries
        overdue_res = await db.execute(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.expected_delivery_date < now,
                PurchaseOrder.goods_status == GoodsStatus.NOT_RECEIVED,
                PurchaseOrder.status.notin_([POStatus.CANCELLED, POStatus.COMPLETED]),
            )
        )
        overdue_deliveries = overdue_res.scalar_one()

        # Recent 5 orders
        recent_res = await db.execute(
            select(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items),
                joinedload(PurchaseOrder.supplier),
                joinedload(PurchaseOrder.linked_sales_order),
            )
            .order_by(PurchaseOrder.id.desc())
            .limit(5)
        )
        recent = [_serialize_po(po) for po in recent_res.unique().scalars().all()]

        return {
            "total_orders": total_orders,
            "total_value": total_value,
            "status_counts": status_counts,
            "type_counts": type_counts,
            "pending_deliveries": pending_deliveries,
            "overdue_deliveries": overdue_deliveries,
            "recent_orders": recent,
        }
