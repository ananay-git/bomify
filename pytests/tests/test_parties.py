"""
Test Suite — Parties (Customers & Suppliers) APIs
==================================================
Covers: CRUD, search, locations, contacts, tags.
"""

import pytest
from httpx import AsyncClient


# ── TC-PARTY-001: Create customer ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_customer(client: AsyncClient, admin_headers: dict):
    resp = await client.post("/parties/", json={
        "party_type": "customer",
        "name": "Acme Industries",
        "contact_person": "John Doe",
        "email": "john@acme.com",
        "phone": "9999999999",
        "gstin": "27AABCA1234F1ZP",
        "city": "Pune",
        "state": "Maharashtra",
    }, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Acme Industries"
    assert data["party_type"] == "customer"


# ── TC-PARTY-002: Create supplier ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_supplier(client: AsyncClient, admin_headers: dict):
    resp = await client.post("/parties/", json={
        "party_type": "supplier",
        "name": "Raw Materials Co",
        "contact_person": "Supplier Contact",
        "city": "Chennai",
    }, headers=admin_headers)
    assert resp.status_code == 201
    assert resp.json()["party_type"] == "supplier"


# ── TC-PARTY-003: List parties ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_parties(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/parties/", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "parties" in data
    assert "total" in data


# ── TC-PARTY-004: Filter by type ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_filter_parties_by_type(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/parties/?party_type=customer", headers=admin_headers)
    assert resp.status_code == 200
    for p in resp.json()["parties"]:
        assert p["party_type"] in ("customer", "both")


# ── TC-PARTY-005: Search parties ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_parties(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/parties/?search=Acme", headers=admin_headers)
    assert resp.status_code == 200


# ── TC-PARTY-006: Get party by ID ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_party_by_id(client: AsyncClient, admin_headers: dict, sample_party: dict):
    party_id = sample_party["id"]
    resp = await client.get(f"/parties/{party_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == party_id


# ── TC-PARTY-007: Update party ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_party(client: AsyncClient, admin_headers: dict, sample_party: dict):
    resp = await client.patch(f"/parties/{sample_party['id']}", json={
        "contact_person": "Updated Contact",
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["contact_person"] == "Updated Contact"


# ── TC-PARTY-008: Add location ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_party_location(client: AsyncClient, admin_headers: dict, sample_party: dict):
    resp = await client.post(f"/parties/{sample_party['id']}/locations", json={
        "location_type": "billing",
        "address_line1": "42 Industrial Area",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
    }, headers=admin_headers)
    assert resp.status_code == 201
    assert resp.json()["city"] == "Mumbai"


# ── TC-PARTY-009: Get locations ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_party_locations(client: AsyncClient, admin_headers: dict, sample_party: dict):
    resp = await client.get(f"/parties/{sample_party['id']}/locations", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── TC-PARTY-010: Add contact ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_party_contact(client: AsyncClient, admin_headers: dict, sample_party: dict):
    resp = await client.post(f"/parties/{sample_party['id']}/contacts", json={
        "contact_name": "Priya Patel",
        "email": "priya@test.com",
        "phone": "9876500001",
        "role": "Procurement Manager",
    }, headers=admin_headers)
    assert resp.status_code == 201


# ── TC-PARTY-011: Add tag ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_party_tag(client: AsyncClient, admin_headers: dict, sample_party: dict):
    resp = await client.post(f"/parties/{sample_party['id']}/tags", json={
        "tag": "premium",
    }, headers=admin_headers)
    assert resp.status_code == 201


# ── TC-PARTY-012: Delete party ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_party(client: AsyncClient, admin_headers: dict):
    # Create a throwaway party
    resp = await client.post("/parties/", json={
        "party_type": "customer",
        "name": "Delete Me Corp",
    }, headers=admin_headers)
    party_id = resp.json()["id"]

    resp = await client.delete(f"/parties/{party_id}", headers=admin_headers)
    assert resp.status_code == 204
