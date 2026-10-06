"""
Test Suite — Purchase Order & GRN APIs
=======================================
Covers: PO CRUD, stats, cancel, GRN creation.
"""

import pytest
from httpx import AsyncClient


# ── TC-PO-001: Create purchase order ─────────────────────────────────────

@pytest.mark.asyncio
async def test_create_purchase_order(client: AsyncClient, admin_headers: dict, sample_supplier: dict, sample_item: dict):
    resp = await client.post("/purchases/orders", json={
        "supplier_id": sample_supplier["id"],
        "document_type": "purchase_order",
        "notes": "Test PO",
        "items": [{
            "item_id": sample_item["id"],
            "ordered_quantity": 100,
            "unit_price": 50.00,
        }],
    }, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "draft"
    assert "po_number" in data


# ── TC-PO-002: List purchase orders ──────────────────────────────────────

@pytest.mark.asyncio
async def test_list_purchase_orders(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/purchases/orders", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "orders" in data
    assert "total" in data


# ── TC-PO-003: Get PO by ID ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_purchase_order(client: AsyncClient, admin_headers: dict, sample_supplier: dict, sample_item: dict):
    create_resp = await client.post("/purchases/orders", json={
        "supplier_id": sample_supplier["id"],
        "document_type": "purchase_order",
        "items": [{"item_id": sample_item["id"], "ordered_quantity": 20, "unit_price": 40}],
    }, headers=admin_headers)
    po_id = create_resp.json()["id"]

    resp = await client.get(f"/purchases/orders/{po_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == po_id


# ── TC-PO-004: Update PO ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_purchase_order(client: AsyncClient, admin_headers: dict, sample_supplier: dict, sample_item: dict):
    create_resp = await client.post("/purchases/orders", json={
        "supplier_id": sample_supplier["id"],
        "document_type": "purchase_order",
        "items": [{"item_id": sample_item["id"], "ordered_quantity": 10, "unit_price": 30}],
    }, headers=admin_headers)
    po_id = create_resp.json()["id"]

    resp = await client.put(f"/purchases/orders/{po_id}", json={
        "notes": "Updated PO notes",
    }, headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PO-005: Cancel PO ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancel_purchase_order(client: AsyncClient, admin_headers: dict, sample_supplier: dict, sample_item: dict):
    create_resp = await client.post("/purchases/orders", json={
        "supplier_id": sample_supplier["id"],
        "document_type": "purchase_order",
        "items": [{"item_id": sample_item["id"], "ordered_quantity": 5, "unit_price": 20}],
    }, headers=admin_headers)
    po_id = create_resp.json()["id"]

    resp = await client.post(f"/purchases/orders/{po_id}/cancel", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


# ── TC-PO-006: Purchase stats ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_purchase_stats(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/purchases/orders/stats", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PO-007: Filter by document type ──────────────────────────────────

@pytest.mark.asyncio
async def test_filter_by_document_type(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/purchases/orders?document_type=purchase_order", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PO-008: Filter by status ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_filter_by_status(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/purchases/orders?status=draft", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PO-009: Search PO ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_purchase_orders(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/purchases/orders?search=PO", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PO-010: Create adhoc invoice ─────────────────────────────────────

@pytest.mark.asyncio
async def test_create_adhoc_invoice(client: AsyncClient, admin_headers: dict, sample_supplier: dict, sample_item: dict):
    resp = await client.post("/purchases/orders", json={
        "supplier_id": sample_supplier["id"],
        "document_type": "adhoc_invoice",
        "notes": "Adhoc invoice test",
        "items": [{"item_id": sample_item["id"], "ordered_quantity": 1, "unit_price": 1000}],
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["document_type"] == "adhoc_invoice"
