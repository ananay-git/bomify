"""
Inventory SQLAlchemy models.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class ItemCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    FINISHED_GOOD = "finished_good"
    PACKAGING = "packaging"

class ProductServiceType(str, enum.Enum):
    PRODUCT = "product"
    SERVICE = "service"

class BuySellType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    BOTH = "both"

class TransactionType(str, enum.Enum):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"

class Item(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[ItemCategory | None] = mapped_column(Enum(ItemCategory), nullable=True, index=True)
    product_service: Mapped[ProductServiceType] = mapped_column(Enum(ProductServiceType), nullable=False, default=ProductServiceType.PRODUCT)
    buy_sell: Mapped[BuySellType] = mapped_column(Enum(BuySellType), nullable=False, default=BuySellType.BUY)
    unit_of_measure: Mapped[str] = mapped_column(String(50)) # e.g., kg, unit, liter
    current_stock: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    default_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    min_stock_level: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    max_stock_level: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    reorder_level: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    regular_buying_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    wholesale_buying_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    regular_selling_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    wholesale_selling_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    description: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True)
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100)) # e.g., PO-001, WO-002
    reference_type: Mapped[str | None] = mapped_column(String(50)) # e.g., 'purchase_order', 'work_order'
    notes: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
