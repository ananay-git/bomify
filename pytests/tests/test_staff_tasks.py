"""
Test Suite — Owner / Staff roles, shared staff tasks and notifications
======================================================================
Covers: staff accounts, the separate owner/staff logins, staff being locked out
of owner endpoints, assigning an order, the shared staff dashboard, finishing an
order (ready for dispatch), notifications for both sides, and the emails queued.
"""

import random

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ── Helpers / fixtures ───────────────────────────────────────────────────

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_staff(client: AsyncClient, admin_headers: dict, name: str) -> dict:
    """Create a staff account through the owner's API and sign in as that staff member."""
    suffix = random.randint(10000, 99999)
    username = f"{name}{suffix}"
    password = "staffpass1"
    resp = await client.post("/users/", json={
        "username": username,
        "email": f"{username}@shop.test",
        "full_name": f"Staff {name.title()}",
        "password": password,
        "role": "staff",
    }, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    user = resp.json()

    login = await client.post("/users/login", json={
        "username": username, "password": password, "login_as": "staff",
    })
    assert login.status_code == 200, login.text
    return {"user": user, "username": username, "password": password,
            "headers": _auth(login.json()["access_token"])}


@pytest_asyncio.fixture
async def staff_a(client: AsyncClient, admin_headers: dict) -> dict:
    return await _make_staff(client, admin_headers, "asha")


@pytest_asyncio.fixture
async def staff_b(client: AsyncClient, admin_headers: dict) -> dict:
    return await _make_staff(client, admin_headers, "ravi")


@pytest_asyncio.fixture
async def sent_emails(monkeypatch) -> list:
    """Capture the emails the API queues instead of sending them."""
    captured: list = []

    async def fake_send(messages):
        captured.extend(messages)

    monkeypatch.setattr("app.modules.tasks.router.send_emails", fake_send)
    return captured


async def _make_order(client, admin_headers, sample_item, sample_raw_material,
                      qty: float = 10, per_unit: float = 2) -> dict:
    """A published BOM (per_unit of the raw material per finished item) + a work order."""
    bom = await client.post("/production/boms", json={
        "bom_name": "Staff Flow BOM",
        "fg_item_id": sample_item["id"],
        "status": "published",
        "items": [{"item_id": sample_raw_material["id"], "quantity": per_unit}],
    }, headers=admin_headers)
    assert bom.status_code == 200, bom.text
    wo = await client.post("/production/work-orders", json={
        "item_id": sample_item["id"], "quantity": qty,
    }, headers=admin_headers)
    assert wo.status_code == 200, wo.text
    return wo.json()


async def _stock(client, headers, item_id: int) -> float:
    resp = await client.get(f"/inventory/items/{item_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["current_stock"]


# ── Staff accounts & the two logins ──────────────────────────────────────

@pytest.mark.asyncio
async def test_staff_account_gets_no_owner_modules(staff_a: dict):
    assert staff_a["user"]["role"] == "staff"
    assert staff_a["user"]["module_permissions"] == []


@pytest.mark.asyncio
async def test_owner_account_is_still_owner(client: AsyncClient, admin_headers: dict):
    me = await client.get("/users/me", headers=admin_headers)
    assert me.status_code == 200
    assert me.json()["role"] == "owner"


@pytest.mark.asyncio
async def test_login_must_match_the_login_screen(client: AsyncClient, staff_a: dict):
    # staff account on the owner login -> refused
    resp = await client.post("/users/login", json={
        "username": staff_a["username"], "password": staff_a["password"], "login_as": "owner",
    })
    assert resp.status_code == 403
    assert "staff" in resp.json()["detail"].lower()

    # owner account on the staff login -> refused
    resp = await client.post("/users/login", json={
        "username": "admin", "password": "admin123", "login_as": "staff",
    })
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()

    # wrong password is still a plain 401
    resp = await client.post("/users/login", json={
        "username": "admin", "password": "not-the-password", "login_as": "owner",
    })
    assert resp.status_code == 401

    # no login_as (API clients, older callers) -> still works
    resp = await client.post("/users/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_staff_are_locked_out_of_owner_endpoints(client: AsyncClient, staff_a: dict):
    h = staff_a["headers"]
    me = await client.get("/users/me", headers=h)
    assert me.status_code == 200 and me.json()["role"] == "staff"

    for path in ["/inventory/items", "/parties/", "/production/work-orders",
                 "/sales/orders", "/purchases/orders", "/dispatch/dispatches", "/users/", "/settings/"]:
        resp = await client.get(path, headers=h)
        assert resp.status_code == 403, f"{path} should be owner-only, got {resp.status_code}"


@pytest.mark.asyncio
async def test_staff_cannot_assign_or_withdraw_tasks(client: AsyncClient, staff_a: dict):
    resp = await client.post("/tasks/assign", json={"work_order_id": 1}, headers=staff_a["headers"])
    assert resp.status_code == 403
    resp = await client.get("/tasks/", headers=staff_a["headers"])
    assert resp.status_code == 403
    resp = await client.post("/tasks/1/cancel", headers=staff_a["headers"])
    assert resp.status_code == 403


# ── Assign -> staff notified -> staff finish -> owner notified ───────────

@pytest.mark.asyncio
async def test_full_loop_assign_notify_complete_notify(
    client: AsyncClient, admin_headers: dict, staff_a: dict, staff_b: dict,
    sample_item: dict, sample_raw_material: dict, sent_emails: list,
):
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=10, per_unit=2)
    fg_before = await _stock(client, admin_headers, sample_item["id"])
    rm_before = await _stock(client, admin_headers, sample_raw_material["id"])

    # 1) Owner assigns the order (work order not started yet — assigning starts it)
    resp = await client.post("/tasks/assign", json={
        "work_order_id": wo["id"], "note": "Use the dark varnish",
    }, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    task = body["task"]
    assert body["notified_staff"] >= 2
    assert task["status"] == "assigned"
    assert task["note"] == "Use the dark varnish"
    assert task["target_quantity"] == 10
    assert task["materials"][0]["quantity"] == 20          # 2 per item x 10

    # 2) Every staff member is notified (in-app) and emailed
    for staff in (staff_a, staff_b):
        notes = await client.get("/notifications/", headers=staff["headers"])
        assert notes.status_code == 200
        latest = notes.json()["notifications"][0]
        assert latest["type"] == "task_assigned"
        assert latest["is_read"] is False
        assert latest["link"] == "/staff"
        assert "Use the dark varnish" in latest["message"]
        assert notes.json()["unread_count"] >= 1
    emailed = {m.to for m in sent_emails}
    assert staff_a["user"]["email"] in emailed and staff_b["user"]["email"] in emailed

    # 3) Everyone on staff sees the SAME task list
    dash_a = (await client.get("/staff/tasks", headers=staff_a["headers"])).json()
    dash_b = (await client.get("/staff/tasks", headers=staff_b["headers"])).json()
    assert task["id"] in [t["id"] for t in dash_a["todo"]]
    assert [t["id"] for t in dash_a["todo"]] == [t["id"] for t in dash_b["todo"]]

    # 4) Staff A finishes it (8 of 10 made) — ticks "done / ready for dispatch"
    sent_emails.clear()
    resp = await client.post(f"/staff/tasks/{task['id']}/complete", json={
        "completed_quantity": 8, "note": "2 pieces cracked",
    }, headers=staff_a["headers"])
    assert resp.status_code == 200, resp.text
    done = resp.json()
    assert done["status"] == "ready_for_dispatch"
    assert done["completed_quantity"] == 8
    assert done["completed_by_name"] == staff_a["user"]["full_name"]

    # stock moved exactly like the owner's own "Mark as Complete"
    assert await _stock(client, admin_headers, sample_item["id"]) == fg_before + 8
    assert await _stock(client, admin_headers, sample_raw_material["id"]) == rm_before - 20

    # 5) The owner is notified, with a link to the dispatch screen, and emailed
    owner_notes = await client.get("/notifications/", headers=admin_headers)
    ready = [n for n in owner_notes.json()["notifications"] if n["type"] == "task_ready_for_dispatch"][0]
    assert ready["link"].startswith("/app/dispatch/create?")
    assert "8" in ready["message"] and "ready to dispatch" in ready["message"]
    assert "2 pieces cracked" in ready["message"]
    assert any(m.to == "admin@quadstack.local" for m in sent_emails)

    # 6) It moves from "to do" to "done" for every staff member
    for staff in (staff_a, staff_b):
        dash = (await client.get("/staff/tasks", headers=staff["headers"])).json()
        assert task["id"] not in [t["id"] for t in dash["todo"]]
        assert task["id"] in [t["id"] for t in dash["done"]]

    # 7) Can't finish twice or assign again
    again = await client.post(f"/staff/tasks/{task['id']}/complete", json={}, headers=staff_b["headers"])
    assert again.status_code == 409
    reassign = await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)
    assert reassign.status_code == 409

    # 8) Notifications can be marked read
    nid = ready["id"]
    before = owner_notes.json()["unread_count"]
    read = await client.post(f"/notifications/{nid}/read", headers=admin_headers)
    assert read.status_code == 200 and read.json()["unread_count"] == before - 1
    all_read = await client.post("/notifications/read-all", headers=admin_headers)
    assert all_read.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_default_quantity_is_the_full_target(
    client: AsyncClient, admin_headers: dict, staff_a: dict,
    sample_item: dict, sample_raw_material: dict,
):
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=5, per_unit=1)
    task = (await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)).json()["task"]
    done = await client.post(f"/staff/tasks/{task['id']}/complete", json={}, headers=staff_a["headers"])
    assert done.status_code == 200, done.text
    assert done.json()["completed_quantity"] == 5


@pytest.mark.asyncio
async def test_not_enough_material_is_reported_to_staff(
    client: AsyncClient, admin_headers: dict, staff_a: dict,
    sample_item: dict, sample_raw_material: dict,
):
    # needs 1000 x 1 = 1000 of a raw material that only has ~500 in stock
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=1000, per_unit=1)
    task = (await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)).json()["task"]
    resp = await client.post(f"/staff/tasks/{task['id']}/complete", json={}, headers=staff_a["headers"])
    assert resp.status_code == 409
    assert "stock" in resp.json()["detail"].lower()
    # the task is still waiting, nothing was half-done
    dash = (await client.get("/staff/tasks", headers=staff_a["headers"])).json()
    assert task["id"] in [t["id"] for t in dash["todo"]]


# ── Withdrawing an order ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_owner_can_withdraw_and_reassign(
    client: AsyncClient, admin_headers: dict, staff_a: dict,
    sample_item: dict, sample_raw_material: dict,
):
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=3, per_unit=1)
    task = (await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)).json()["task"]

    cancel = await client.post(f"/tasks/{task['id']}/cancel", headers=admin_headers)
    assert cancel.status_code == 200 and cancel.json()["status"] == "cancelled"

    dash = (await client.get("/staff/tasks", headers=staff_a["headers"])).json()
    assert task["id"] not in [t["id"] for t in dash["todo"]]
    blocked = await client.post(f"/staff/tasks/{task['id']}/complete", json={}, headers=staff_a["headers"])
    assert blocked.status_code == 409

    notes = (await client.get("/notifications/", headers=staff_a["headers"])).json()["notifications"]
    assert notes[0]["type"] == "task_cancelled"

    again = await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)
    assert again.status_code == 201
    assert again.json()["task"]["id"] == task["id"]          # same row, sent out again
    assert again.json()["task"]["status"] == "assigned"


@pytest.mark.asyncio
async def test_owner_task_list_hides_withdrawn_orders(
    client: AsyncClient, admin_headers: dict, sample_item: dict, sample_raw_material: dict,
):
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=2, per_unit=1)
    task = (await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)).json()["task"]
    listed = (await client.get("/tasks/", headers=admin_headers)).json()
    assert task["id"] in [t["id"] for t in listed["tasks"]]
    await client.post(f"/tasks/{task['id']}/cancel", headers=admin_headers)
    listed = (await client.get("/tasks/", headers=admin_headers)).json()
    assert task["id"] not in [t["id"] for t in listed["tasks"]]
    with_cancelled = (await client.get("/tasks/?include_cancelled=true", headers=admin_headers)).json()
    assert task["id"] in [t["id"] for t in with_cancelled["tasks"]]


# ── Validation ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_needs_exactly_one_target(client: AsyncClient, admin_headers: dict):
    neither = await client.post("/tasks/assign", json={}, headers=admin_headers)
    assert neither.status_code == 422
    both = await client.post("/tasks/assign", json={"work_order_id": 1, "process_id": 1}, headers=admin_headers)
    assert both.status_code == 422


@pytest.mark.asyncio
async def test_assign_unknown_order_is_404(client: AsyncClient, admin_headers: dict):
    resp = await client.post("/tasks/assign", json={"work_order_id": 99999999}, headers=admin_headers)
    assert resp.status_code == 404


# ── Notifications are private ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notifications_are_private_to_each_person(
    client: AsyncClient, admin_headers: dict, staff_a: dict, staff_b: dict,
    sample_item: dict, sample_raw_material: dict,
):
    wo = await _make_order(client, admin_headers, sample_item, sample_raw_material, qty=2, per_unit=1)
    await client.post("/tasks/assign", json={"work_order_id": wo["id"]}, headers=admin_headers)
    a_note = (await client.get("/notifications/", headers=staff_a["headers"])).json()["notifications"][0]
    # staff B cannot mark staff A's notification as read
    resp = await client.post(f"/notifications/{a_note['id']}/read", headers=staff_b["headers"])
    assert resp.status_code == 404
