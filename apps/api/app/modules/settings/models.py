"""
Settings SQLAlchemy models — key-value store grouped by category.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = (
        UniqueConstraint("category", "key", name="uq_settings_category_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g. "company", "numbering", "tax", "workflow"
    key: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True
    )  # e.g. "company_name", "sales_order_prefix"
    value: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # Flexible — string, number, bool, dict, list
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<Setting {self.category}.{self.key}={self.value}>"
