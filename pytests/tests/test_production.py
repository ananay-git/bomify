"""
Test Suite — Production APIs (BOM, Work Orders, Processes, Sub Contracts)
=========================================================================
"""

import pytest
from httpx import AsyncClient


# ── TC-BOM-001: Next BOM ID ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_next_bom_id(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/production/boms/next-id", headers=admin_headers)
    assert resp.status_code == 200
    assert "bom_id" in resp.json()


# ── TC-BOM-002: Create BOM ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_bom(client: AsyncClient, admin_headers: dict, sample_item: dict, sample_raw_material: dict):
    resp = await client.post("/production/boms", json={
        "bom_name": "Test BOM",
        "fg_item_id": sample_item["id"],
        "items": [{"item_id": sample_raw_material["id"], "quantity": 5}],
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["bom_name"] == "Test BOM"


# ── TC-BOM-003: List BOMs ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_boms(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/production/boms", headers=admin_headers)
    assert resp.status_code == 200
    assert "boms" in resp.json()


# ── TC-BOM-004: Get BOM ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_bom(client: AsyncClient, admin_headers: dict, sample_item: dict, sample_raw_material: dict):
    create_resp = await client.post("/production/boms", json={
        "bom_name": "Get BOM Test",
        "fg_item_id": sample_item["id"],
        "items": [{"item_id": sample_raw_material["id"], "quantity": 3}],
    }, headers=admin_headers)
    bom_pk = create_resp.json()["id"]

    resp = await client.get(f"/production/boms/{bom_pk}", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-WO-001: Create work order ────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_work_order(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.post("/production/work-orders", json={
        "item_id": sample_item["id"],
        "quantity": 50,
    }, headers=admin_headers)
    assert resp.status_code == 200


# ── TC-WO-002: List work orders ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_work_orders(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/production/work-orders", headers=admin_headers)
    assert resp.status_code == 200
    assert "orders" in resp.json()


# ── TC-WO-003: Get work order ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_work_order(client: AsyncClient, admin_headers: dict, sample_item: dict):
    create_resp = await client.post("/production/work-orders", json={
        "item_id": sample_item["id"],
        "quantity": 10,
    }, headers=admin_headers)
    wo_id = create_resp.json()["id"]

    resp = await client.get(f"/production/work-orders/{wo_id}", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PROC-001: List production processes ───────────────────────────────

@pytest.mark.asyncio
async def test_list_processes(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/production/processes", headers=admin_headers)
    assert resp.status_code == 200
    assert "processes" in resp.json()


# ── TC-SC-001: Create sub-contract ──────────────────────────────────────

@pytest.mark.asyncio
async def test_create_sub_contract(client: AsyncClient, admin_headers: dict, sample_item: dict):
    resp = await client.post("/production/sub-contracts", json={
        "fg_item_id": sample_item["id"],
        "target_quantity": 100,
    }, headers=admin_headers)
    assert resp.status_code == 200


# ── TC-SC-002: List sub-contracts ───────────────────────────────────────

@pytest.mark.asyncio
async def test_list_sub_contracts(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/production/sub-contracts", headers=admin_headers)
    assert resp.status_code == 200
    assert "sub_contracts" in resp.json()
