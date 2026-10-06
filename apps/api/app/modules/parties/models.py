"""
Party (Customer / Supplier) SQLAlchemy models.
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PartyType(str, enum.Enum):
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    BOTH = "both"
    BUYER = "buyer"

class LocationType(str, enum.Enum):
    BILLING = "billing"
    SHIPPING = "shipping"
    DELIVERY = "delivery"

class Party(Base):
    __tablename__ = "parties"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    party_type: Mapped[PartyType] = mapped_column(Enum(PartyType), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    contact_person: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    gstin: Mapped[str | None] = mapped_column(String(15))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(10))
    payment_terms: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    
    # --- NEW FIELDS ---
    reference_code: Mapped[str | None] = mapped_column(String(50))
    gst_type: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str | None] = mapped_column(String(20), default="active")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # --- RELATIONSHIPS ---
    locations: Mapped[list["Location"]] = relationship("Location", back_populates="party", cascade="all, delete-orphan")
    contacts: Mapped[list["PartyContact"]] = relationship("PartyContact", back_populates="party", cascade="all, delete-orphan")
    tags: Mapped[list["PartyTag"]] = relationship("PartyTag", back_populates="party", cascade="all, delete-orphan")
    
class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    party_id: Mapped[int] = mapped_column(ForeignKey("parties.id", ondelete="CASCADE"))
    location_type: Mapped[LocationType] = mapped_column(Enum(LocationType), nullable=False, index=True)
    
    address_line1: Mapped[str] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str | None] = mapped_column(String(100))
    gstin: Mapped[str | None] = mapped_column(String(15))
    is_default: Mapped[bool] = mapped_column(default=False)
    
    # Audit and Soft Delete
    is_deleted: Mapped[bool] = mapped_column(default=False)
    created_by: Mapped[str | None] = mapped_column(String(100))
    updated_by: Mapped[str | None] = mapped_column(String(100))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    party: Mapped["Party"] = relationship("Party", back_populates="locations")

class PartyContact(Base):
    __tablename__ = "party_contacts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    party_id: Mapped[int] = mapped_column(ForeignKey("parties.id", ondelete="CASCADE"))
    contact_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str | None] = mapped_column(String(100))

    party: Mapped["Party"] = relationship("Party", back_populates="contacts")

class PartyTag(Base):
    __tablename__ = "party_tags"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    party_id: Mapped[int] = mapped_column(ForeignKey("parties.id", ondelete="CASCADE"))
    tag: Mapped[str] = mapped_column(String(50))

    party: Mapped["Party"] = relationship("Party", back_populates="tags")