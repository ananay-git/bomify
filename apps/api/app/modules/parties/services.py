"""
Business logic for the Parties module.
"""
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.parties.models import Party, PartyType, Location, PartyContact, PartyTag
from app.modules.parties.schemas import (
    PartyCreate,
    PartyUpdate,
    LocationCreate,
    LocationUpdate,
    PartyContactCreate,
    PartyContactUpdate,
    PartyTagCreate
)


def _party_load_options():
    # Filter soft-deleted locations at load time. Never reassign party.locations:
    # with delete-orphan cascade, dropping rows from the collection hard-deletes them.
    return (
        selectinload(Party.locations.and_(Location.is_deleted.is_(False))),
        selectinload(Party.contacts),
        selectinload(Party.tags),
    )


async def get_party_by_id(db: AsyncSession, party_id: int) -> Party:
    result = await db.execute(
        select(Party)
        .options(*_party_load_options())
        .where(Party.id == party_id)
        .execution_options(populate_existing=True)
    )
    party = result.scalar_one_or_none()
    if not party:
        raise NotFoundError(detail=f"Party with id {party_id} not found")
    return party


async def _ensure_party(db: AsyncSession, party_id: int) -> None:
    if not await db.get(Party, party_id):
        raise NotFoundError(detail=f"Party with id {party_id} not found")


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
    query = select(Party).options(*_party_load_options())
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
    result = await db.execute(
        query.offset(skip).limit(limit).order_by(Party.id.desc())
        .execution_options(populate_existing=True)
    )
    parties = list(result.scalars().all())
    return parties, total


async def update_party(db: AsyncSession, party_id: int, data: PartyUpdate) -> Party:
    party = await get_party_by_id(db, party_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(party, field, value)
    await db.flush()
    return await get_party_by_id(db, party_id)


async def delete_party(db: AsyncSession, party_id: int) -> None:
    from app.modules.sales.models import SalesOrder
    from app.modules.purchases.models import PurchaseOrder

    party = await get_party_by_id(db, party_id)

    so_count = (await db.execute(
        select(func.count(SalesOrder.id)).where(SalesOrder.customer_id == party_id)
    )).scalar_one()
    location_ids = select(Location.id).where(Location.party_id == party_id)
    po_count = (await db.execute(
        select(func.count(PurchaseOrder.id)).where(or_(
            PurchaseOrder.supplier_id == party_id,
            PurchaseOrder.billing_location_id.in_(location_ids),
            PurchaseOrder.delivery_location_id.in_(location_ids),
        ))
    )).scalar_one()
    if so_count or po_count:
        raise ConflictError(
            f"Cannot delete '{party.name}': it is used by {so_count} sales order(s) and "
            f"{po_count} purchase document(s). Mark it inactive instead."
        )

    await db.delete(party)
    await db.flush()


# ==========================================
# FUNCTIONS FOR SUB-ITEMS
# ==========================================

async def _get_location(db: AsyncSession, party_id: int, location_id: int) -> Location:
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.party_id == party_id,
            Location.is_deleted.is_(False),
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise NotFoundError(detail="Location not found")
    return loc


async def _clear_other_defaults(db: AsyncSession, loc: Location) -> None:
    """Keep a single default location per party and location type."""
    await db.execute(
        update(Location)
        .where(
            Location.party_id == loc.party_id,
            Location.location_type == loc.location_type,
            Location.id != loc.id,
            Location.is_default.is_(True),
        )
        .values(is_default=False)
        .execution_options(synchronize_session="fetch")
    )


async def get_party_locations(db: AsyncSession, party_id: int) -> list[Location]:
    await _ensure_party(db, party_id)
    result = await db.execute(
        select(Location)
        .where(Location.party_id == party_id)
        .where(Location.is_deleted.is_(False))
        .order_by(Location.id)
    )
    return list(result.scalars().all())

async def add_party_location(db: AsyncSession, party_id: int, data: LocationCreate) -> Location:
    await _ensure_party(db, party_id)
    loc = Location(party_id=party_id, **data.model_dump())
    db.add(loc)
    await db.flush()
    if loc.is_default:
        await _clear_other_defaults(db, loc)
    await db.refresh(loc)
    return loc

async def update_party_location(
    db: AsyncSession, party_id: int, location_id: int, data: LocationUpdate
) -> Location:
    loc = await _get_location(db, party_id, location_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    await db.flush()
    if loc.is_default:
        await _clear_other_defaults(db, loc)
    await db.refresh(loc)
    return loc

async def delete_party_location(db: AsyncSession, party_id: int, location_id: int) -> None:
    result = await db.execute(
        select(Location).where(Location.id == location_id, Location.party_id == party_id)
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise NotFoundError(detail="Location not found")
    if not loc.is_deleted:
        # Soft delete: documents may still reference this address.
        loc.is_deleted = True
        loc.is_default = False
        await db.flush()

async def add_party_contact(db: AsyncSession, party_id: int, data: PartyContactCreate) -> PartyContact:
    await _ensure_party(db, party_id)
    contact = PartyContact(party_id=party_id, **data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact

async def _get_contact(db: AsyncSession, party_id: int, contact_id: int) -> PartyContact:
    result = await db.execute(
        select(PartyContact).where(PartyContact.id == contact_id, PartyContact.party_id == party_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise NotFoundError(detail="Contact not found")
    return contact

async def update_party_contact(
    db: AsyncSession, party_id: int, contact_id: int, data: PartyContactUpdate
) -> PartyContact:
    contact = await _get_contact(db, party_id, contact_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.flush()
    await db.refresh(contact)
    return contact

async def delete_party_contact(db: AsyncSession, party_id: int, contact_id: int) -> None:
    contact = await _get_contact(db, party_id, contact_id)
    await db.delete(contact)
    await db.flush()

async def add_party_tag(db: AsyncSession, party_id: int, data: PartyTagCreate) -> PartyTag:
    await _ensure_party(db, party_id)
    tag = PartyTag(party_id=party_id, **data.model_dump())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag

async def delete_party_tag(db: AsyncSession, party_id: int, tag_id: int) -> None:
    result = await db.execute(
        select(PartyTag).where(PartyTag.id == tag_id, PartyTag.party_id == party_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise NotFoundError(detail="Tag not found")
    await db.delete(tag)
    await db.flush()
