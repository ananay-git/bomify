"""
Test Suite — Inventory APIs
============================
Covers: items CRUD, SKU generation, stock transactions, dashboard.
"""

import pytest
from httpx import AsyncClient


# ── TC-INV-001: Create inventory item ─────────────────────────────────────

@pytest.mark.asyncio
async def test_create_item(client: AsyncClient, admin_headers: dict):
    resp = await client.post("/inventory/items", json={
        "sku": "INV-TEST-001",
        "name": "Bolt M8",
        "category": "raw_material",
        "product_service": "product",
        "buy_sell": "buy",
        "unit_of_measure": "pcs",
        "current_stock": 1000,
        "default_price": 5.50,
        "hsn_code": "7318",
        "tax": 18.0,
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["sku"] == "INV-TEST-001"


# ── TC-INV-002: List items ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_items(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/inventory/items", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


# ── TC-INV-003: Get item by ID ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_item(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.get(f"/inventory/items/{sample_item['id']}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == sample_item["id"]


# ── TC-INV-004: Update item ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_item(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.put(f"/inventory/items/{sample_item['id']}", json={
        "name": "Updated Widget",
        "default_price": 300.00,
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Widget"


# ── TC-INV-005: Next SKU ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_next_sku(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/inventory/items/next-sku", headers=admin_headers)
    assert resp.status_code == 200
    assert "sku" in resp.json()


# ── TC-INV-006: Add stock transaction ────────────────────────────────────

@pytest.mark.asyncio
async def test_add_stock_transaction(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.post("/inventory/transactions", json={
        "item_id": sample_item["id"],
        "transaction_type": "in",
        "quantity": 50,
        "reference_id": "PO-TEST-001",
        "reference_type": "purchase_order",
        "notes": "Test stock inward",
    }, headers=admin_headers)
    assert resp.status_code == 200


# ── TC-INV-007: List transactions ────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_transactions(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/inventory/transactions", headers=admin_headers)
    assert resp.status_code == 200
    assert "transactions" in resp.json()


# ── TC-INV-008: Filter transactions by item ──────────────────────────────

@pytest.mark.asyncio
async def test_list_transactions_by_item(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.get(f"/inventory/transactions?item_id={sample_item['id']}", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-INV-009: Inventory dashboard ──────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_dashboard(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/inventory/dashboard", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-INV-010: Duplicate SKU rejected ───────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_sku_rejected(client: AsyncClient, admin_headers: dict):
    payload = {
        "sku": "DUP-SKU-001",
        "name": "Dup Item 1",
        "unit_of_measure": "pcs",
        "product_service": "product",
        "buy_sell": "buy",
    }
    await client.post("/inventory/items", json=payload, headers=admin_headers)
    resp = await client.post("/inventory/items", json=payload, headers=admin_headers)
    assert resp.status_code in (400, 409, 500)
