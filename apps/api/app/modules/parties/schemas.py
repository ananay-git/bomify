"""
Pydantic schemas for the Parties module (Customers & Suppliers).
"""
from collections.abc import Sequence
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.modules.parties.models import PartyType, LocationType

# --- NEW: Nested Schemas ---
class LocationBase(BaseModel):
    location_type: LocationType
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    gstin: str | None = None
    is_default: bool = False

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    location_type: LocationType | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    gstin: str | None = None
    is_default: bool | None = None

class LocationResponse(LocationBase):
    id: int
    party_id: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class PartyContactCreate(BaseModel):
    contact_name: str
    email: EmailStr | None = None
    phone: str | None = None
    role: str | None = None

class PartyContactResponse(PartyContactCreate):
    id: int
    model_config = {"from_attributes": True}

class PartyTagCreate(BaseModel):
    tag: str

class PartyTagResponse(PartyTagCreate):
    id: int
    model_config = {"from_attributes": True}

# --- Base Party Schemas ---
class PartyCreate(BaseModel):
    party_type: PartyType
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    gstin: str | None = Field(None, max_length=15)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    pincode: str | None = Field(None, max_length=10)
    payment_terms: str | None = Field(None, max_length=100)
    notes: str | None = None
    reference_code: str | None = None
    gst_type: str | None = None

class PartyUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    contact_person: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    gstin: str | None = Field(None, max_length=15)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    pincode: str | None = Field(None, max_length=10)
    payment_terms: str | None = Field(None, max_length=100)
    notes: str | None = None
    reference_code: str | None = None
    gst_type: str | None = None
    status: str | None = None

class PartyResponse(BaseModel):
    id: int
    party_type: PartyType
    name: str
    contact_person: str | None
    email: str | None
    phone: str | None
    gstin: str | None
    address: str | None
    city: str | None
    state: str | None
    pincode: str | None
    payment_terms: str | None
    notes: str | None
    reference_code: str | None
    gst_type: str | None
    status: str | None
    created_at: datetime
    updated_at: datetime

    locations: list[LocationResponse] = []
    contacts: list[PartyContactResponse] = []
    tags: list[PartyTagResponse] = []

    model_config = {"from_attributes": True}

class PartyListResponse(BaseModel):
    parties: Sequence[PartyResponse]
    total: int

class PartyContactUpdate(BaseModel):
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    role: str | None = None