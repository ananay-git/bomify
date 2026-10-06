"""
Staff task model.

A staff task is a production order the owner has sent to the shop floor. Every
staff member sees the same list — tasks are not tied to one person.

Lifecycle:  assigned  ->  ready_for_dispatch   (or  cancelled by the owner)
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TaskStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    READY_FOR_DISPATCH = "ready_for_dispatch"
    CANCELLED = "cancelled"


class StaffTask(Base):
    __tablename__ = "staff_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # The production process staff will carry out (one task per process).
    process_id: Mapped[int] = mapped_column(
        ForeignKey("production_processes.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    work_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_orders.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            native_enum=False,
            length=30,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=TaskStatus.ASSIGNED,
        server_default=TaskStatus.ASSIGNED.value,
        index=True,
        nullable=False,
    )

    # Instructions from the owner
    note: Mapped[str | None] = mapped_column(Text)
    assigned_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    assigned_by_name: Mapped[str | None] = mapped_column(String(100))
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Filled in when staff mark the order done
    completed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    completed_by_name: Mapped[str | None] = mapped_column(String(100))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_quantity: Mapped[float | None] = mapped_column(Numeric(10, 2))
    completion_note: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
