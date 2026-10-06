"""
Business logic for the Parties module.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.parties.models import Party, PartyType, Location, PartyContact, PartyTag

# ---> FIXED: Added LocationUpdate and PartyContactUpdate to the imports here! <---
from app.modules.parties.schemas import (
    PartyCreate, 
    PartyUpdate, 
    LocationCreate, 
    LocationUpdate,
    PartyContactCreate, 
    PartyContactUpdate,
    PartyTagCreate
)


async def get_party_by_id(db: AsyncSession, party_id: int) -> Party:
    result = await db.execute(
        select(Party)
        .options(
            selectinload(Party.locations),
            selectinload(Party.contacts),
            selectinload(Party.tags)
        )
        .where(Party.id == party_id)
    )
    party = result.scalar_one_or_none()
    if not party:
        raise NotFoundError(detail=f"Party with id {party_id} not found")
    # Filter out deleted locations in python as selectinload doesn't easily filter
    party.locations = [loc for loc in party.locations if not loc.is_deleted]
    return party


async def create_party(db: AsyncSession, data: PartyCreate) -> Party:
    party = Party(**data.model_dump())
    db.add(party)
    await db.flush()
    return await get_party_by_id(db, party.id)


async def list_parties(
    db: AsyncSession,
    party_type: PartyType | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Party], int]:
    query = select(Party).options(
        selectinload(Party.locations),
        selectinload(Party.contacts),
        selectinload(Party.tags)
    )
    count_query = select(func.count(Party.id))

    if party_type:
        query = query.where(Party.party_type == party_type)
        count_query = count_query.where(Party.party_type == party_type)

    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            Party.name.ilike(like_pattern)
            | Party.contact_person.ilike(like_pattern)
            | Party.city.ilike(like_pattern)
        )
        count_query = count_query.where(
            Party.name.ilike(like_pattern)
            | Party.contact_person.ilike(like_pattern)
            | Party.city.ilike(like_pattern)
        )

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.offset(skip).limit(limit).order_by(Party.id.desc()))
    parties = list(result.scalars().all())
    return parties, total


async def update_party(db: AsyncSession, party_id: int, data: PartyUpdate) -> Party:
    party = await get_party_by_id(db, party_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(party, field, value)
    await db.flush()
    return await get_party_by_id(db, party_id)


async def delete_party(db: AsyncSession, party_id: int) -> None:
    party = await get_party_by_id(db, party_id)
    await db.delete(party)
    await db.flush()


# ==========================================
# FUNCTIONS FOR SUB-ITEMS
# ==========================================

async def get_party_locations(db: AsyncSession, party_id: int) -> list[Location]:
    result = await db.execute(
        select(Location)
        .where(Location.party_id == party_id)
        .where(Location.is_deleted == False)
    )
    return list(result.scalars().all())

async def add_party_location(db: AsyncSession, party_id: int, data: LocationCreate) -> Location:
    loc = Location(party_id=party_id, **data.model_dump())
    db.add(loc)
    await db.flush()
    await db.refresh(loc)
    return loc

async def update_party_location(db: AsyncSession, location_id: int, data: LocationUpdate) -> Location:
    result = await db.execute(select(Location).where(Location.id == location_id).where(Location.is_deleted == False))
    loc = result.scalar_one_or_none()
    if not loc: 
        raise NotFoundError(detail="Location not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    await db.flush()
    await db.refresh(loc)
    return loc

async def delete_party_location(db: AsyncSession, location_id: int) -> None:
    result = await db.execute(select(Location).where(Location.id == location_id))
    loc = result.scalar_one_or_none()
    if loc and not loc.is_deleted:
        loc.is_deleted = True
        await db.flush()

async def add_party_contact(db: AsyncSession, party_id: int, data: PartyContactCreate) -> PartyContact:
    contact = PartyContact(party_id=party_id, **data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact

async def update_party_contact(db: AsyncSession, contact_id: int, data: PartyContactUpdate) -> PartyContact:
    result = await db.execute(select(PartyContact).where(PartyContact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact: 
        raise NotFoundError(detail="Contact not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.flush()
    await db.refresh(contact)
    return contact

async def delete_party_contact(db: AsyncSession, contact_id: int) -> None:
    result = await db.execute(select(PartyContact).where(PartyContact.id == contact_id))
    contact = result.scalar_one_or_none()
    if contact:
        await db.delete(contact)
        await db.flush()

async def add_party_tag(db: AsyncSession, party_id: int, data: PartyTagCreate) -> PartyTag:
    tag = PartyTag(party_id=party_id, **data.model_dump())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag

async def delete_party_tag(db: AsyncSession, tag_id: int) -> None:
    result = await db.execute(select(PartyTag).where(PartyTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if tag:
        await db.delete(tag)
        await db.flush()