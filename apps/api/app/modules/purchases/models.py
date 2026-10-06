"""
Purchases SQLAlchemy models.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey, Numeric, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIAL = "partial"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"

class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETE = "complete"

class GoodsStatus(str, enum.Enum):
    NOT_RECEIVED = "not_received"
    RECEIVED = "received"

class DocumentType(str, enum.Enum):
    PURCHASE_ORDER = "purchase_order"
    SERVICE_ORDER = "service_order"
    ORDER_CONFIRMATION = "order_confirmation"
    SERVICE_CONFIRMATION = "service_confirmation"
    INVOICE = "invoice"
    ADHOC_INVOICE = "adhoc_invoice"

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("parties.id", ondelete="RESTRICT"), index=True)
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="documenttype"), default=DocumentType.PURCHASE_ORDER, index=True
    )
    linked_sales_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sales_orders.id", ondelete="SET NULL"), index=True, nullable=True
    )
    status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.DRAFT, index=True)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    invoice_status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING)
    goods_status: Mapped[GoodsStatus] = mapped_column(Enum(GoodsStatus), default=GoodsStatus.NOT_RECEIVED)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # Locations
    billing_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="RESTRICT"), index=True)
    delivery_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="RESTRICT"), index=True)
    
    expected_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    # Document tab fields
    extra_charges: Mapped[dict | None] = mapped_column(JSON)  # [{description, amount, tax_rate}]
    terms_conditions: Mapped[str | None] = mapped_column(Text)
    comments: Mapped[dict | None] = mapped_column(JSON)  # [{author, text, created_at}]
    additional_details: Mapped[dict | None] = mapped_column(JSON)  # [{key, value}]
    signature_data: Mapped[dict | None] = mapped_column(JSON)  # {image_base64, signer_name, signed_at}
    attachments: Mapped[dict | None] = mapped_column(JSON)  # [{name, type, size, data_base64, uploaded_at}]
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items: Mapped[list["POItem"]] = relationship("POItem", back_populates="purchase_order", cascade="all, delete-orphan")
    supplier: Mapped["Party"] = relationship("Party", lazy="joined", foreign_keys=[supplier_id])
    linked_sales_order: Mapped["SalesOrder | None"] = relationship("SalesOrder", lazy="joined", foreign_keys=[linked_sales_order_id])

class POItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"))
    ordered_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    received_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    
    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")

class GRN(Base):
    __tablename__ = "goods_receipt_notes"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="RESTRICT"), index=True)
    grn_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    receipt_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["GRNItem"]] = relationship("GRNItem", back_populates="grn", cascade="all, delete-orphan")

class GRNItem(Base):
    __tablename__ = "grn_items"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    grn_id: Mapped[int] = mapped_column(ForeignKey("goods_receipt_notes.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"))
    received_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    accepted_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    rejected_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    
    grn: Mapped["GRN"] = relationship("GRN", back_populates="items")


# Import at bottom to avoid circular imports
from app.modules.parties.models import Party  # noqa: E402, F401
from app.modules.sales.models import SalesOrder  # noqa: E402, F401
