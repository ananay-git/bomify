"""
Production SQLAlchemy models.
BOM, Work Orders, Production Processes, and Sub Contracts.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey, Numeric, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class BOMStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class WorkOrderStage(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProcessStage(str, enum.Enum):
    OPEN = "open"
    MATERIAL_ISSUED = "material_issued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProcessStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    RUNNING = "running"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProcessType(str, enum.Enum):
    MASTER = "master"
    CHILD = "child"


class SubContractStage(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SubContractStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# ─── Bill of Materials ───────────────────────────────────────────────────────

class BOM(Base):
    __tablename__ = "boms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bom_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    bom_name: Mapped[str] = mapped_column(String(200), nullable=False)
    fg_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"), index=True)
    status: Mapped[BOMStatus] = mapped_column(Enum(BOMStatus, native_enum=False), default=BOMStatus.DRAFT, index=True)

    last_modified_by: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items: Mapped[list["BOMItem"]] = relationship("BOMItem", back_populates="bom", cascade="all, delete-orphan")


class BOMItem(Base):
    __tablename__ = "bom_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("boms.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    bom: Mapped["BOM"] = relationship("BOM", back_populates="items")


# ─── Work Orders ─────────────────────────────────────────────────────────────

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("parties.id", ondelete="SET NULL"), index=True)
    document_number: Mapped[str | None] = mapped_column(String(100), index=True)
    order_type: Mapped[str | None] = mapped_column(String(50))
    process_number: Mapped[str | None] = mapped_column(String(100))
    process_stage: Mapped[WorkOrderStage] = mapped_column(Enum(WorkOrderStage, native_enum=False), default=WorkOrderStage.OPEN, index=True)
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    document_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ─── Production Process ──────────────────────────────────────────────────────

class ProductionProcess(Base):
    __tablename__ = "production_processes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), index=True)
    process_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    stage: Mapped[ProcessStage] = mapped_column(Enum(ProcessStage, native_enum=False), default=ProcessStage.OPEN, index=True)
    status: Mapped[ProcessStatus] = mapped_column(Enum(ProcessStatus, native_enum=False), default=ProcessStatus.NOT_STARTED, index=True)
    bom_id: Mapped[int | None] = mapped_column(ForeignKey("boms.id", ondelete="SET NULL"), index=True)
    work_order_id: Mapped[int | None] = mapped_column(ForeignKey("work_orders.id", ondelete="SET NULL"), index=True)
    fg_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"), index=True)
    process_type: Mapped[ProcessType] = mapped_column(Enum(ProcessType, native_enum=False), default=ProcessType.MASTER)

    target_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    completed_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)

    order_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_completion_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    last_modified_by: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    issued_items: Mapped[list["IssuedItem"]] = relationship("IssuedItem", back_populates="production_process", cascade="all, delete-orphan")


class IssuedItem(Base):
    """Raw materials issued (deducted from inventory) for a production process."""
    __tablename__ = "issued_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_process_id: Mapped[int] = mapped_column(ForeignKey("production_processes.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"))
    required_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    issued_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    production_process: Mapped["ProductionProcess"] = relationship("ProductionProcess", back_populates="issued_items")


# ─── Sub Contract ────────────────────────────────────────────────────────────

class SubContract(Base):
    __tablename__ = "sub_contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    process_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    job_work_number: Mapped[str | None] = mapped_column(String(100), index=True)
    stage: Mapped[SubContractStage] = mapped_column(Enum(SubContractStage, native_enum=False), default=SubContractStage.OPEN, index=True)
    status: Mapped[SubContractStatus] = mapped_column(Enum(SubContractStatus, native_enum=False), default=SubContractStatus.NOT_STARTED, index=True)
    fg_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="RESTRICT"), index=True)

    target_quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    completed_quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)

    created_by: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
