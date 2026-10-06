"""
API endpoints for the Parties module (Customers & Suppliers).
  GET  /parties?party_type=customer  →  Selling > Customer list
  GET  /parties?party_type=supplier  →  Buying  > Supplier list
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.parties.models import PartyType
from app.modules.parties.schemas import (
    PartyCreate,
    PartyListResponse,
    PartyResponse,
    PartyUpdate,
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    PartyContactCreate,
    PartyContactResponse,
    PartyContactUpdate,
    PartyTagCreate,
    PartyTagResponse,
)
from app.modules.parties import services
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/parties", tags=["Parties (Customers & Suppliers)"])


@router.get("/", response_model=PartyListResponse)
async def list_parties(
    party_type: PartyType | None = Query(
        None, description="Filter by customer or supplier"
    ),
    search: str | None = Query(
        None, description="Search by name, contact person, or city"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List parties, optionally filtered by type and search term."""
    parties, total = await services.list_parties(
        db, party_type=party_type, search=search, skip=skip, limit=limit
    )
    return PartyListResponse(
        parties=[PartyResponse.model_validate(p) for p in parties],
        total=total,
    )


@router.post("/", response_model=PartyResponse, status_code=201)
async def create_party(
    body: PartyCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Create a new customer or supplier."""
    return await services.create_party(db, body)


@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get a specific party by ID."""
    return await services.get_party_by_id(db, party_id)


@router.patch("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: int,
    body: PartyUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Update a party."""
    return await services.update_party(db, party_id, body)


@router.delete("/{party_id}", status_code=204)
async def delete_party(
    party_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Delete a party."""
    await services.delete_party(db, party_id)


# --- Sub-resource routes (locations, contacts, tags) ---

@router.post("/{party_id}/locations", response_model=LocationResponse, status_code=201)
async def add_location(
    party_id: int,
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.add_party_location(db, party_id, body)

@router.get("/{party_id}/locations", response_model=list[LocationResponse])
async def get_locations(
    party_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.get_party_locations(db, party_id)

@router.post("/{party_id}/contacts", response_model=PartyContactResponse, status_code=201)
async def add_contact(
    party_id: int,
    body: PartyContactCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.add_party_contact(db, party_id, body)

@router.post("/{party_id}/tags", response_model=PartyTagResponse, status_code=201)
async def add_tag(
    party_id: int,
    body: PartyTagCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.add_party_tag(db, party_id, body)

@router.patch("/{party_id}/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    party_id: int,
    location_id: int,
    body: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.update_party_location(db, location_id, body)

@router.delete("/{party_id}/locations/{location_id}", status_code=204)
async def delete_location(
    party_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    await services.delete_party_location(db, location_id)

@router.patch("/{party_id}/contacts/{contact_id}", response_model=PartyContactResponse)
async def update_contact(
    party_id: int,
    contact_id: int,
    body: PartyContactUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await services.update_party_contact(db, contact_id, body)

@router.delete("/{party_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(
    party_id: int,
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    await services.delete_party_contact(db, contact_id)

@router.delete("/{party_id}/tags/{tag_id}", status_code=204)
async def delete_tag(
    party_id: int,
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    await services.delete_party_tag(db, tag_id)