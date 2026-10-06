"""
Test Suite — Sales Order APIs
==============================
Covers: CRUD, lifecycle transitions, next-number, search/filter.
"""

import pytest
from httpx import AsyncClient


# ── TC-SALES-001: Get next order number ───────────────────────────────────

@pytest.mark.asyncio
async def test_next_order_number(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/sales/orders/next-number", headers=admin_headers)
    assert resp.status_code == 200
    assert "order_number" in resp.json()


# ── TC-SALES-002: Create sales order ─────────────────────────────────────

@pytest.mark.asyncio
async def test_create_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "payment_terms": "Net 30",
        "notes": "Test sales order",
        "items": [{
            "item_id": sample_item["id"],
            "description": "Test Widget",
            "quantity": 10,
            "unit_price": 250.00,
            "discount": 0,
            "tax_rate": 18.0,
        }],
    }, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "draft"
    assert len(data["items"]) == 1


# ── TC-SALES-003: List sales orders ──────────────────────────────────────

@pytest.mark.asyncio
async def test_list_sales_orders(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/sales/orders", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "orders" in data
    assert "total" in data


# ── TC-SALES-004: Get order by ID ────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    # Create first
    create_resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "items": [{"item_id": sample_item["id"], "quantity": 5, "unit_price": 100}],
    }, headers=admin_headers)
    order_id = create_resp.json()["id"]

    resp = await client.get(f"/sales/orders/{order_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == order_id


# ── TC-SALES-005: Update sales order ─────────────────────────────────────

@pytest.mark.asyncio
async def test_update_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    create_resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "items": [{"item_id": sample_item["id"], "quantity": 3, "unit_price": 200}],
    }, headers=admin_headers)
    order_id = create_resp.json()["id"]

    resp = await client.put(f"/sales/orders/{order_id}", json={
        "notes": "Updated notes",
        "payment_terms": "Net 15",
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Updated notes"


# ── TC-SALES-006: Confirm order ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    create_resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "items": [{"item_id": sample_item["id"], "quantity": 2, "unit_price": 100}],
    }, headers=admin_headers)
    order_id = create_resp.json()["id"]

    resp = await client.post(f"/sales/orders/{order_id}/confirm", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


# ── TC-SALES-007: Process order ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_process_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    create_resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "items": [{"item_id": sample_item["id"], "quantity": 1, "unit_price": 100}],
    }, headers=admin_headers)
    order_id = create_resp.json()["id"]
    await client.post(f"/sales/orders/{order_id}/confirm", headers=admin_headers)

    resp = await client.post(f"/sales/orders/{order_id}/process", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"


# ── TC-SALES-008: Cancel order ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancel_sales_order(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    create_resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "items": [{"item_id": sample_item["id"], "quantity": 1, "unit_price": 50}],
    }, headers=admin_headers)
    order_id = create_resp.json()["id"]

    resp = await client.delete(f"/sales/orders/{order_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


# ── TC-SALES-009: Filter by status ───────────────────────────────────────

@pytest.mark.asyncio
async def test_filter_orders_by_status(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/sales/orders?status=draft", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-SALES-010: Order with document tabs ───────────────────────────────

@pytest.mark.asyncio
async def test_order_with_document_tabs(client: AsyncClient, admin_headers: dict, sample_party: dict, sample_item: dict):
    resp = await client.post("/sales/orders", json={
        "customer_id": sample_party["id"],
        "notes": "Order with extras",
        "extra_charges": [{"description": "Shipping", "amount": 500}],
        "terms_conditions": "Standard T&C apply",
        "comments": [{"author": "admin", "text": "Urgent order"}],
        "additional_details": [{"key": "Priority", "value": "High"}],
        "items": [{"item_id": sample_item["id"], "quantity": 5, "unit_price": 100}],
    }, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["extra_charges"] is not None
    assert data["terms_conditions"] == "Standard T&C apply"
