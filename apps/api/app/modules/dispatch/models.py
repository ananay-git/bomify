"""
Dispatch SQLAlchemy models.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DispatchStatus(str, enum.Enum):
    DRAFT = "draft"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Dispatch(Base):
    __tablename__ = "dispatches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dispatch_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    sales_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"), nullable=True)
    production_process_id: Mapped[int | None] = mapped_column(ForeignKey("production_processes.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[DispatchStatus] = mapped_column(Enum(DispatchStatus, native_enum=False), default=DispatchStatus.DRAFT, index=True)
    logistics_partner: Mapped[str | None] = mapped_column(String(100))
    tracking_number: Mapped[str | None] = mapped_column(String(100))
    dispatch_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vehicle_details: Mapped[str | None] = mapped_column(String(200))
    driver_name: Mapped[str | None] = mapped_column(String(100))
    driver_phone: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    items: Mapped[list["DispatchItem"]] = relationship("DispatchItem", back_populates="dispatch", cascade="all, delete-orphan")
    sales_order: Mapped["SalesOrder"] = relationship("SalesOrder", lazy="joined")


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dispatch_id: Mapped[int] = mapped_column(ForeignKey("dispatches.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    picked_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    packed_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    # Relationships
    dispatch: Mapped["Dispatch"] = relationship("Dispatch", back_populates="items")
    inventory_item: Mapped["Item"] = relationship("Item", lazy="joined")


# Import at bottom to avoid circular imports
from app.modules.sales.models import SalesOrder  # noqa: E402, F401
from app.modules.inventory.models import Item  # noqa: E402, F401
