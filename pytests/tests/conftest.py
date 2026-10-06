"""
QuadStack API — Pytest Configuration & Shared Fixtures
======================================================
Provides an async test client wired to a real (test) PostgreSQL database
via docker-compose, shared auth tokens, and factory helpers.

Usage:
    docker compose up -d db redis
    pytest pytests/tests -v
"""

import os, sys
from datetime import datetime, timezone

import pytest
import pytest_asyncio
import httpx
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete

# ── Ensure the API package is importable ──────────────────────────────────
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API_DIR = os.path.join(ROOT_DIR, "apps", "api")
sys.path.insert(0, API_DIR)

os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "quadstack")
os.environ.setdefault("POSTGRES_PASSWORD", "quadstack_dev")
os.environ.setdefault("POSTGRES_DB", "quadstack")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("ADMIN_EMAIL", "admin@quadstack.local")
os.environ.setdefault("ADMIN_FULL_NAME", "System Administrator")

from app.main import app  # noqa: E402
from app.core.database import Base, engine, async_session  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.modules.users.models import Module, User, UserModuleAccess  # noqa: E402


# ── Create tables once per session ────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Reset schema and seed deterministic admin before test session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await session.execute(delete(UserModuleAccess))
        await session.execute(delete(User))

        admin = User(
            username="admin",
            email="admin@quadstack.local",
            full_name="System Administrator",
            hashed_password=hash_password("admin123"),
            is_active=True,
        )
        session.add(admin)
        await session.flush()

        for mod in Module:
            session.add(UserModuleAccess(user_id=admin.id, module=mod))

        await session.commit()

    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Async HTTP client ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    """Yields an httpx AsyncClient bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver/api") as ac:
        yield ac


# ── Auth helper ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    """Login as the seeded admin and return the JWT bearer token."""
    resp = await client.post("/users/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def admin_headers(admin_token: str) -> dict:
    """Returns Authorization headers for admin."""
    return {"Authorization": f"Bearer {admin_token}"}


# ── Factory helpers ───────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_party(client: AsyncClient, admin_headers: dict) -> dict:
    """Create and return a sample customer party."""
    resp = await client.post("/parties/", json={
        "party_type": "customer",
        "name": "Test Customer Pvt Ltd",
        "contact_person": "Rahul Sharma",
        "email": "rahul@testcustomer.in",
        "phone": "9876543210",
        "gstin": "27AABCT1234F1ZP",
        "address": "123 MG Road",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
    }, headers=admin_headers)
    assert resp.status_code == 201, f"Party creation failed: {resp.text}"
    return resp.json()


@pytest_asyncio.fixture
async def sample_supplier(client: AsyncClient, admin_headers: dict) -> dict:
    """Create and return a sample supplier party."""
    resp = await client.post("/parties/", json={
        "party_type": "supplier",
        "name": "Test Supplier Inc",
        "contact_person": "Amit Kumar",
        "email": "amit@testsupplier.in",
        "phone": "9876500000",
        "city": "Delhi",
        "state": "Delhi",
    }, headers=admin_headers)
    assert resp.status_code == 201, f"Supplier creation failed: {resp.text}"
    return resp.json()


@pytest_asyncio.fixture
async def sample_item(client: AsyncClient, admin_headers: dict) -> dict:
    """Create and return a sample inventory item."""
    import random
    sku = f"TEST-SKU-{random.randint(10000, 99999)}"
    resp = await client.post("/inventory/items", json={
        "sku": sku,
        "name": "Test Widget",
        "category": "finished_good",
        "product_service": "product",
        "buy_sell": "both",
        "unit_of_measure": "pcs",
        "current_stock": 100.0,
        "default_price": 250.00,
        "hsn_code": "8471",
        "tax": 18.0,
        "min_stock_level": 10.0,
        "max_stock_level": 500.0,
        "reorder_level": 20.0,
    }, headers=admin_headers)
    assert resp.status_code == 200, f"Item creation failed: {resp.text}"
    return resp.json()


@pytest_asyncio.fixture
async def sample_raw_material(client: AsyncClient, admin_headers: dict) -> dict:
    """Create and return a raw-material inventory item."""
    import random
    sku = f"RM-{random.randint(10000, 99999)}"
    resp = await client.post("/inventory/items", json={
        "sku": sku,
        "name": "Steel Bar",
        "category": "raw_material",
        "product_service": "product",
        "buy_sell": "buy",
        "unit_of_measure": "kg",
        "current_stock": 500.0,
        "default_price": 80.00,
        "tax": 18.0,
    }, headers=admin_headers)
    assert resp.status_code == 200, f"RM item creation failed: {resp.text}"
    return resp.json()
