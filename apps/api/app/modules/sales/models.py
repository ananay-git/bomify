"""
Sales SQLAlchemy models.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    QUOTATION_SENT = "quotation_sent"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    INVOICED = "invoiced"
    PAID = "paid"
    CANCELLED = "cancelled"


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("parties.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="orderstatus_v2"), default=OrderStatus.DRAFT, index=True
    )
    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expected_delivery_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    payment_terms: Mapped[str | None] = mapped_column(
        String(50)
    )  # Net 15, Net 30, Immediate, etc.
    billing_address: Mapped[dict | None] = mapped_column(JSON)
    shipping_address: Mapped[dict | None] = mapped_column(JSON)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text)

    # Document tab fields
    extra_charges: Mapped[dict | None] = mapped_column(JSON)  # [{description, amount, tax_rate}]
    terms_conditions: Mapped[str | None] = mapped_column(Text)
    comments: Mapped[dict | None] = mapped_column(JSON)  # [{author, text, created_at}]
    additional_details: Mapped[dict | None] = mapped_column(JSON)  # [{key, value}]
    signature_data: Mapped[dict | None] = mapped_column(JSON)  # {image_base64, signer_name, signed_at}
    attachments: Mapped[dict | None] = mapped_column(JSON)  # [{name, type, size, data_base64, uploaded_at}]

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    items: Mapped[list["SalesOrderItem"]] = relationship(
        "SalesOrderItem", back_populates="sales_order", cascade="all, delete-orphan"
    )
    customer: Mapped["Party"] = relationship("Party", lazy="joined")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT")
    )
    description: Mapped[str | None] = mapped_column(String(500))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # Percentage
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # e.g., 18% GST
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    sales_order: Mapped["SalesOrder"] = relationship(
        "SalesOrder", back_populates="items"
    )
    inventory_item: Mapped["Item"] = relationship("Item", lazy="joined")


# Import at bottom to avoid circular imports
from app.modules.parties.models import Party  # noqa: E402, F401
from app.modules.inventory.models import Item  # noqa: E402, F401
