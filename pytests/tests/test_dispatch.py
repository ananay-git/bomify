"""
Test Suite — Dispatch APIs
===========================
Covers: CRUD, lifecycle (pack/ship/deliver), dispatchable orders.
"""

import pytest
from httpx import AsyncClient


# ── TC-DISP-001: Get next dispatch number ────────────────────────────────

@pytest.mark.asyncio
async def test_next_dispatch_number(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/dispatch/dispatches/next-number", headers=admin_headers)
    assert resp.status_code == 200
    assert "dispatch_number" in resp.json()


# ── TC-DISP-002: Get dispatchable sales orders ──────────────────────────

@pytest.mark.asyncio
async def test_dispatchable_sales_orders(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/dispatch/sales-orders/dispatchable", headers=admin_headers)
    assert resp.status_code == 200
    assert "orders" in resp.json()


# ── TC-DISP-003: Get production-ready items ──────────────────────────────

@pytest.mark.asyncio
async def test_production_ready_items(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/dispatch/production-ready", headers=admin_headers)
    assert resp.status_code == 200
    assert "items" in resp.json()


# ── TC-DISP-004: List dispatches ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_dispatches(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/dispatch/dispatches", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "dispatches" in data
    assert "total" in data


# ── TC-DISP-005: Filter dispatches by status ─────────────────────────────

@pytest.mark.asyncio
async def test_filter_dispatches(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/dispatch/dispatches?status=draft", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-DISP-006: Create dispatch ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_dispatch(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.post("/dispatch/dispatches", json={
        "logistics_partner": "BlueDart",
        "vehicle_details": "MH-12-AB-1234",
        "driver_name": "Test Driver",
        "driver_phone": "9876543210",
        "notes": "Test dispatch",
        "items": [{"product_id": sample_item["id"], "quantity": 5}],
    }, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "draft"
    assert "dispatch_number" in data
