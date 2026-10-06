"""
Seed script — runs Alembic migrations, sets up the copilot_reader DB role,
and creates the initial admin user.

Run: python -m app.seed
"""

import asyncio
import subprocess
import sys

from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import async_session
from app.core.security import hash_password
from app.modules.users.models import Module, User, UserModuleAccess, UserRole

# Import all models so they are registered with SQLAlchemy metadata
from app.modules.parties.models import Party  # noqa: F401
from app.modules.inventory.models import Item, StockTransaction, ItemCategory, ProductServiceType, BuySellType  # noqa: F401
from app.modules.sales.models import SalesOrder, SalesOrderItem  # noqa: F401
from app.modules.purchases.models import PurchaseOrder, POItem, GRN, GRNItem  # noqa: F401
from app.modules.production.models import (  # noqa: F401
    BOM, BOMItem, WorkOrder, ProductionProcess, IssuedItem, SubContract, BOMStatus,
)
from app.modules.dispatch.models import Dispatch  # noqa: F401
from app.modules.copilot.models import CopilotThread, CopilotChart  # noqa: F401
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.notifications.models import Notification  # noqa: F401
from app.modules.tasks.models import StaffTask  # noqa: F401
from app.modules.settings.services import seed_default_settings


def run_migrations() -> None:
    """Run Alembic migrations to head — idempotent, safe to re-run."""
    print("Running Alembic migrations...")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "heads"],
        capture_output=False,
    )
    if result.returncode != 0:
        print("ERROR: Alembic migrations failed. Aborting.")
        sys.exit(result.returncode)
    print("Migrations complete.")


async def setup_copilot_reader() -> None:
    """
    Create the restricted copilot_reader PostgreSQL role and grant it
    SELECT-only access. Fully idempotent — safe to run on every startup.
    """
    print("Setting up copilot_reader role...")
    # Escape any single-quotes in the password to prevent SQL injection
    escaped_pw = settings.COPILOT_DB_PASSWORD.replace("'", "''")
    async with async_session() as session:
        await session.execute(text(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'copilot_reader') THEN
                    CREATE ROLE copilot_reader WITH LOGIN PASSWORD '{escaped_pw}' NOINHERIT;
                    RAISE NOTICE 'Role copilot_reader created.';
                ELSE
                    RAISE NOTICE 'Role copilot_reader already exists, skipping creation.';
                END IF;
            END
            $$;
        """))

        await session.execute(text(
            f"GRANT CONNECT ON DATABASE {settings.POSTGRES_DB} TO copilot_reader;"
        ))
        await session.execute(text(
            "GRANT USAGE ON SCHEMA public TO copilot_reader;"
        ))
        await session.execute(text(
            "GRANT SELECT ON ALL TABLES IN SCHEMA public TO copilot_reader;"
        ))
        await session.execute(text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO copilot_reader;"
        ))
        await session.execute(text(
            "GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO copilot_reader;"
        ))
        await session.execute(text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO copilot_reader;"
        ))
        await session.commit()
    print("copilot_reader role ready.")


async def seed_admin() -> None:
    """Create the initial admin user if it doesn't already exist."""
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        existing_admin = result.scalar_one_or_none()
        if existing_admin:
            existing_modules = await session.execute(
                select(UserModuleAccess).where(UserModuleAccess.user_id == existing_admin.id)
            )
            if not existing_modules.scalars().first():
                for mod in Module:
                    session.add(UserModuleAccess(user_id=existing_admin.id, module=mod))
                await session.commit()
                print(
                    f"Admin user '{settings.ADMIN_USERNAME}' existed without module access; "
                    "default modules were restored."
                )
            else:
                print(f"Admin user '{settings.ADMIN_USERNAME}' already exists, skipping seed.")
            return

        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            full_name=settings.ADMIN_FULL_NAME,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
            role=UserRole.OWNER,
        )
        session.add(admin)
        await session.flush()  # assigns admin.id

        for mod in Module:
            session.add(UserModuleAccess(user_id=admin.id, module=mod))

        await session.commit()
        print(f"Admin user created: {settings.ADMIN_USERNAME} / {settings.ADMIN_PASSWORD}")


async def seed_demo_bom() -> None:
    """
    Seed a demo BOM (Wooden Chair) with raw-material inventory items.
    Idempotent — skips creation if the BOM already exists.
    """
    async with async_session() as session:
        # Skip if demo BOM already seeded
        existing = await session.execute(select(BOM).where(BOM.bom_id == "BOM-DEMO-001"))
        if existing.scalar_one_or_none():
            print("Demo BOM already exists, skipping seed.")
            return

        # ── Raw materials ────────────────────────────────────────────────────
        raw_materials = [
            dict(sku="RM-WOOD-OAK-01",  name="Oak Wood Plank",        unit_of_measure="pcs",  current_stock=500, default_price=12.50,  regular_buying_price=12.50,  category=ItemCategory.RAW_MATERIAL, buy_sell=BuySellType.BUY),
            dict(sku="RM-FOAM-SEAT-01", name="Seat Foam Padding",      unit_of_measure="pcs",  current_stock=300, default_price=8.00,   regular_buying_price=8.00,   category=ItemCategory.RAW_MATERIAL, buy_sell=BuySellType.BUY),
            dict(sku="RM-FABRIC-01",    name="Upholstery Fabric",      unit_of_measure="meter", current_stock=200, default_price=5.50,  regular_buying_price=5.50,   category=ItemCategory.RAW_MATERIAL, buy_sell=BuySellType.BUY),
            dict(sku="RM-SCREW-M8-01",  name="M8 Wood Screws (Box)",   unit_of_measure="box",  current_stock=1000, default_price=2.00,  regular_buying_price=2.00,  category=ItemCategory.RAW_MATERIAL, buy_sell=BuySellType.BUY),
            dict(sku="RM-VARNISH-01",   name="Wood Varnish (1L)",      unit_of_measure="liter", current_stock=150, default_price=6.75,  regular_buying_price=6.75,  category=ItemCategory.RAW_MATERIAL, buy_sell=BuySellType.BUY),
        ]

        rm_items = []
        for rm in raw_materials:
            result = await session.execute(select(Item).where(Item.sku == rm["sku"]))
            item = result.scalar_one_or_none()
            if not item:
                item = Item(
                    sku=rm["sku"],
                    name=rm["name"],
                    category=rm["category"],
                    product_service=ProductServiceType.PRODUCT,
                    buy_sell=rm["buy_sell"],
                    unit_of_measure=rm["unit_of_measure"],
                    current_stock=rm["current_stock"],
                    default_price=rm["default_price"],
                    regular_buying_price=rm["regular_buying_price"],
                )
                session.add(item)
                await session.flush()
            rm_items.append(item)

        # ── Finished good ────────────────────────────────────────────────────
        fg_sku = "FG-CHAIR-OAK-01"
        result = await session.execute(select(Item).where(Item.sku == fg_sku))
        fg_item = result.scalar_one_or_none()
        if not fg_item:
            fg_item = Item(
                sku=fg_sku,
                name="Oak Dining Chair",
                category=ItemCategory.FINISHED_GOOD,
                product_service=ProductServiceType.PRODUCT,
                buy_sell=BuySellType.SELL,
                unit_of_measure="pcs",
                current_stock=0,
                default_price=149.99,
                regular_selling_price=149.99,
                wholesale_selling_price=120.00,
            )
            session.add(fg_item)
            await session.flush()

        # ── BOM ──────────────────────────────────────────────────────────────
        bom = BOM(
            bom_id="BOM-DEMO-001",
            bom_name="Oak Dining Chair — Standard BOM",
            fg_item_id=fg_item.id,
            status=BOMStatus.PUBLISHED,
            last_modified_by="admin",
        )
        session.add(bom)
        await session.flush()

        # quantity per finished unit
        bom_lines = [
            (rm_items[0], 4.00),   # 4 Oak Wood Planks
            (rm_items[1], 1.00),   # 1 Seat Foam Padding
            (rm_items[2], 0.50),   # 0.5 m Upholstery Fabric
            (rm_items[3], 1.00),   # 1 box M8 Screws
            (rm_items[4], 0.25),   # 0.25 L Wood Varnish
        ]
        for item, qty in bom_lines:
            session.add(BOMItem(bom_id=bom.id, item_id=item.id, quantity=qty))

        await session.commit()
        print("Demo BOM seeded: BOM-DEMO-001 — Oak Dining Chair (5 components).")


async def seed_dummy_erp_data() -> None:
    """Seed additional dummy data: Parties, Locations, and more Inventory."""
    from app.modules.parties.models import Party, PartyType, Location, LocationType
    from app.modules.inventory.models import Item, ItemCategory, ProductServiceType, BuySellType
    
    async with async_session() as session:
        # Check if already seeded
        existing = await session.execute(select(Party).where(Party.name == "Acme Timbers"))
        if existing.scalar_one_or_none():
            print("Dummy ERP data already exists, skipping.")
            return

        # Create Suppliers
        supplier1 = Party(party_type=PartyType.SUPPLIER, name="Acme Timbers", email="contact@acmetimbers.com", phone="555-0101")
        supplier2 = Party(party_type=PartyType.SUPPLIER, name="Global Hardware", email="sales@globalhardware.com", phone="555-0102")
        
        # Create Customers
        customer1 = Party(party_type=PartyType.CUSTOMER, name="Home Essentials", email="orders@homeessentials.com", phone="555-0201")
        customer2 = Party(party_type=PartyType.CUSTOMER, name="Modern Furniture Ltd", email="procurement@modernfurniture.org", phone="555-0202")
        
        session.add_all([supplier1, supplier2, customer1, customer2])
        await session.flush()
        
        # Add predefined locations
        loc1 = Location(party_id=supplier1.id, location_type=LocationType.SHIPPING, address_line1="123 Timber Lane", city="Woodville", is_default=True)
        loc2 = Location(party_id=supplier2.id, location_type=LocationType.SHIPPING, address_line1="456 Steel Rd", city="Metropolis", is_default=True)
        loc3 = Location(party_id=customer1.id, location_type=LocationType.DELIVERY, address_line1="789 Retail Blvd", city="Commerce City", is_default=True)
        loc4 = Location(party_id=customer2.id, location_type=LocationType.DELIVERY, address_line1="101 Design Ave", city="Trendy Town", is_default=True)
        
        session.add_all([loc1, loc2, loc3, loc4])
        
        # Add more inventory items
        extra_items = [
            Item(sku="RM-PAINT-WHT", name="White Paint (1 Gal)", category=ItemCategory.RAW_MATERIAL, product_service=ProductServiceType.PRODUCT, buy_sell=BuySellType.BUY, unit_of_measure="gallon", current_stock=50, default_price=25.00, regular_buying_price=25.00),
            Item(sku="RM-GLUE-01", name="Wood Glue (1L)", category=ItemCategory.RAW_MATERIAL, product_service=ProductServiceType.PRODUCT, buy_sell=BuySellType.BUY, unit_of_measure="liter", current_stock=200, default_price=5.00, regular_buying_price=5.00),
            Item(sku="FG-TABLE-OAK", name="Oak Dining Table", category=ItemCategory.FINISHED_GOOD, product_service=ProductServiceType.PRODUCT, buy_sell=BuySellType.SELL, unit_of_measure="pcs", current_stock=10, default_price=350.00, regular_selling_price=350.00, wholesale_selling_price=300.00),
        ]
        session.add_all(extra_items)
        
        await session.commit()
        print("Dummy ERP data seeded successfully (Parties, Locations, More Items).")


async def backfill_opening_stock() -> None:
    """Give stock that has no ledger history an opening-stock entry, so the
    stock ledger explains every unit on hand. Idempotent."""
    from app.modules.inventory.models import TransactionType

    async with async_session() as session:
        has_history = select(StockTransaction.item_id).distinct()
        result = await session.execute(
            select(Item).where(Item.current_stock != 0, Item.id.not_in(has_history))
        )
        items = result.scalars().all()
        for item in items:
            stock = float(item.current_stock)
            session.add(StockTransaction(
                item_id=item.id,
                transaction_type=TransactionType.IN if stock > 0 else TransactionType.OUT,
                quantity=abs(stock),
                reference_id=item.sku,
                reference_type="opening_stock",
                notes="Opening stock",
            ))
        await session.commit()
        if items:
            print(f"Recorded opening stock for {len(items)} item(s).")


async def async_main() -> None:
    await setup_copilot_reader()
    await seed_admin()
    await seed_demo_bom()
    await seed_dummy_erp_data()
    await backfill_opening_stock()
    # Seed default ERP settings
    async with async_session() as session:
        await seed_default_settings(session)
        await session.commit()
        print("Default settings seeded.")


if __name__ == "__main__":
    run_migrations()
    asyncio.run(async_main())
