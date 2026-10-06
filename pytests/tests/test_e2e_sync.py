"""
Test Suite — End-to-End Cross-Module Sync
==========================================
Exercises full business flows across modules and asserts that the data
stays consistent everywhere it is reflected:

  * Sales Order  → Dispatch → Inventory (stock moves exactly once)
  * Purchase Order → Inward (GRN) → Inventory
  * Sales Order → Work Order → Production → Dispatch
  * Parties ↔ Locations ↔ Documents

Every flow also checks the stock-ledger invariant: replaying the item's
stock transactions (opening stock included) reproduces its current stock.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session
from app.modules.parties.models import Location


# ── Helpers ───────────────────────────────────────────────────────────────

def _uid() -> str:
    return uuid.uuid4().hex[:8].upper()


async def mk_item(client: AsyncClient, h: dict, stock: float = 0, *,
                  category: str = "finished_good", buy_sell: str = "both",
                  price: float = 100.0) -> dict:
    resp = await client.post("/inventory/items", json={
        "sku": f"E2E-{_uid()}",
        "name": f"E2E Item {_uid()}",
        "category": category,
        "product_service": "product",
        "buy_sell": buy_sell,
        "unit_of_measure": "pcs",
        "current_stock": stock,
        "default_price": price,
    }, headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def mk_party(client: AsyncClient, h: dict, party_type: str = "customer") -> dict:
    resp = await client.post("/parties/", json={
        "party_type": party_type,
        "name": f"E2E {party_type} {_uid()}",
    }, headers=h)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def stock_of(client: AsyncClient, h: dict, item_id: int) -> float:
    resp = await client.get(f"/inventory/items/{item_id}", headers=h)
    assert resp.status_code == 200, resp.text
    return float(resp.json()["current_stock"])


async def ledger_replay(client: AsyncClient, h: dict, item_id: int) -> float:
    """Stock level obtained by replaying the item's ledger in order."""
    resp = await client.get("/inventory/transactions",
                            params={"item_id": item_id, "limit": 1000}, headers=h)
    assert resp.status_code == 200, resp.text
    level = 0.0
    for tx in sorted(resp.json()["transactions"], key=lambda t: t["id"]):
        if tx["transaction_type"] == "in":
            level += float(tx["quantity"])
        elif tx["transaction_type"] == "out":
            level -= float(tx["quantity"])
        else:  # adjustment sets the absolute level
            level = float(tx["quantity"])
    return level


async def assert_ledger_consistent(client: AsyncClient, h: dict, item: dict) -> None:
    current = await stock_of(client, h, item["id"])
    replayed = await ledger_replay(client, h, item["id"])
    assert replayed == pytest.approx(current), (
        f"Ledger out of sync for {item['sku']}: ledger says {replayed}, item says {current}"
    )


async def mk_so(client: AsyncClient, h: dict, customer_id: int,
                lines: list[tuple[int, float]], confirm: bool = False) -> dict:
    resp = await client.post("/sales/orders", json={
        "customer_id": customer_id,
        "items": [{"item_id": i, "quantity": q, "unit_price": 100} for i, q in lines],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    so = resp.json()
    if confirm:
        resp = await client.post(f"/sales/orders/{so['id']}/confirm", headers=h)
        assert resp.status_code == 200, resp.text
        so = resp.json()
    return so


async def mk_dispatch(client: AsyncClient, h: dict, lines: list[tuple[int, float]],
                      so_id: int | None = None, process_id: int | None = None) -> dict:
    resp = await client.post("/dispatch/dispatches", json={
        "sales_order_id": so_id,
        "production_process_id": process_id,
        "items": [{"product_id": i, "quantity": q} for i, q in lines],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def so_status(client: AsyncClient, h: dict, so_id: int) -> str:
    resp = await client.get(f"/sales/orders/{so_id}", headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()["status"]


async def mk_po(client: AsyncClient, h: dict, supplier_id: int,
                lines: list[tuple[int, float]], status: str = "sent") -> dict:
    resp = await client.post("/purchases/orders", json={
        "po_number": f"PO-E2E-{_uid()}",
        "supplier_id": supplier_id,
        "document_type": "purchase_order",
        "status": status,
        "items": [{"item_id": i, "ordered_quantity": q, "unit_price": 10} for i, q in lines],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def grn(client: AsyncClient, h: dict, po_id: int,
              lines: list[tuple[int, float]], number: str | None = None):
    return await client.post("/purchases/grn", json={
        "po_id": po_id,
        "grn_number": number or f"GRN-E2E-{_uid()}",
        "items": [
            {"item_id": i, "received_quantity": q, "accepted_quantity": q, "rejected_quantity": 0}
            for i, q in lines
        ],
    }, headers=h)


# ══════════════════════════════════════════════════════════════════════════
# A. Sales Order ↔ Dispatch ↔ Inventory
# ══════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_so_dispatch_full_flow_moves_stock_exactly_once(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=50)
    cust = await mk_party(client, h)

    so = await mk_so(client, h, cust["id"], [(item["id"], 10)], confirm=True)
    assert so["status"] == "confirmed"

    d = await mk_dispatch(client, h, [(item["id"], 10)], so_id=so["id"])
    resp = await client.post(f"/dispatch/dispatches/{d['id']}/pack", headers=h)
    assert resp.status_code == 200, resp.text
    assert await so_status(client, h, so["id"]) == "processing"

    resp = await client.post(f"/dispatch/dispatches/{d['id']}/ship",
                             json={"tracking_number": "TRK1"}, headers=h)
    assert resp.status_code == 200, resp.text
    assert await so_status(client, h, so["id"]) == "shipped"

    resp = await client.post(f"/dispatch/dispatches/{d['id']}/deliver", headers=h)
    assert resp.status_code == 200, resp.text

    # 10 units left the warehouse — exactly once.
    assert await stock_of(client, h, item["id"]) == pytest.approx(40)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_order_that_consumes_all_stock_can_still_be_dispatched(client, admin_headers):
    """Confirming an order for all stock must not block its own dispatch."""
    h = admin_headers
    item = await mk_item(client, h, stock=10)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 10)], confirm=True)

    orders = (await client.get("/dispatch/sales-orders/dispatchable", headers=h)).json()["orders"]
    line = next(o for o in orders if o["id"] == so["id"])["items"][0]
    assert line["remaining_quantity"] == pytest.approx(10)
    # The UI refuses to dispatch more than available_stock — it must cover the order.
    assert line["available_stock"] >= 10

    d = await mk_dispatch(client, h, [(item["id"], 10)], so_id=so["id"])
    resp = await client.post(f"/dispatch/dispatches/{d['id']}/pack", headers=h)
    assert resp.status_code == 200, resp.text
    assert await stock_of(client, h, item["id"]) == pytest.approx(0)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_partial_dispatch_keeps_order_processing_until_fully_shipped(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=30)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 10)], confirm=True)

    d1 = await mk_dispatch(client, h, [(item["id"], 4)], so_id=so["id"])
    await client.post(f"/dispatch/dispatches/{d1['id']}/pack", headers=h)
    resp = await client.post(f"/dispatch/dispatches/{d1['id']}/ship", headers=h)
    assert resp.status_code == 200, resp.text
    # Only 4 of 10 shipped — order is not "shipped" yet.
    assert await so_status(client, h, so["id"]) == "processing"

    orders = (await client.get("/dispatch/sales-orders/dispatchable", headers=h)).json()["orders"]
    entry = next(o for o in orders if o["id"] == so["id"])
    assert entry["items"][0]["remaining_quantity"] == pytest.approx(6)

    # Over-dispatch is rejected.
    resp = await client.post("/dispatch/dispatches", json={
        "sales_order_id": so["id"], "items": [{"product_id": item["id"], "quantity": 7}],
    }, headers=h)
    assert resp.status_code == 409

    d2 = await mk_dispatch(client, h, [(item["id"], 6)], so_id=so["id"])
    await client.post(f"/dispatch/dispatches/{d2['id']}/pack", headers=h)
    await client.post(f"/dispatch/dispatches/{d2['id']}/ship", headers=h)
    assert await so_status(client, h, so["id"]) == "shipped"

    assert await stock_of(client, h, item["id"]) == pytest.approx(20)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_same_item_on_two_lines_is_dispatchable_in_full(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=20)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 3), (item["id"], 2)], confirm=True)

    orders = (await client.get("/dispatch/sales-orders/dispatchable", headers=h)).json()["orders"]
    entry = next(o for o in orders if o["id"] == so["id"])
    assert sum(i["remaining_quantity"] for i in entry["items"]) == pytest.approx(5)

    d = await mk_dispatch(client, h, [(item["id"], 5)], so_id=so["id"])
    await client.post(f"/dispatch/dispatches/{d['id']}/pack", headers=h)
    await client.post(f"/dispatch/dispatches/{d['id']}/ship", headers=h)
    assert await so_status(client, h, so["id"]) == "shipped"
    assert await stock_of(client, h, item["id"]) == pytest.approx(15)


@pytest.mark.asyncio
async def test_confirm_accounts_for_stock_committed_to_other_orders(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=10)
    cust = await mk_party(client, h)

    await mk_so(client, h, cust["id"], [(item["id"], 8)], confirm=True)
    so2 = await mk_so(client, h, cust["id"], [(item["id"], 5)])
    resp = await client.post(f"/sales/orders/{so2['id']}/confirm", headers=h)
    assert resp.status_code == 409, resp.text  # only 2 uncommitted units left

    so3 = await mk_so(client, h, cust["id"], [(item["id"], 2)])
    resp = await client.post(f"/sales/orders/{so3['id']}/confirm", headers=h)
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_cancel_confirmed_order_leaves_stock_unchanged(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=25)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 5)], confirm=True)
    draft = await mk_dispatch(client, h, [(item["id"], 5)], so_id=so["id"])

    resp = await client.delete(f"/sales/orders/{so['id']}", headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"

    # Draft dispatch for a cancelled order is cancelled with it.
    d = (await client.get(f"/dispatch/dispatches/{draft['id']}", headers=h)).json()
    assert d["status"] == "cancelled"

    assert await stock_of(client, h, item["id"]) == pytest.approx(25)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_cancel_order_with_packed_dispatch_is_blocked(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=25)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 5)], confirm=True)
    d = await mk_dispatch(client, h, [(item["id"], 5)], so_id=so["id"])
    await client.post(f"/dispatch/dispatches/{d['id']}/pack", headers=h)
    assert await stock_of(client, h, item["id"]) == pytest.approx(20)

    resp = await client.delete(f"/sales/orders/{so['id']}", headers=h)
    assert resp.status_code == 409, resp.text

    # Cancelling the packed dispatch restores stock and re-opens the order.
    resp = await client.delete(f"/dispatch/dispatches/{d['id']}", headers=h)
    assert resp.status_code == 200, resp.text
    assert await stock_of(client, h, item["id"]) == pytest.approx(25)
    assert await so_status(client, h, so["id"]) == "confirmed"

    resp = await client.delete(f"/sales/orders/{so['id']}", headers=h)
    assert resp.status_code == 200, resp.text
    assert await stock_of(client, h, item["id"]) == pytest.approx(25)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_direct_ship_records_stock_movement_once(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=12)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 3)], confirm=True)

    resp = await client.post(f"/sales/orders/{so['id']}/ship", headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "shipped"
    assert await stock_of(client, h, item["id"]) == pytest.approx(9)
    await assert_ledger_consistent(client, h, item)


@pytest.mark.asyncio
async def test_so_update_returns_new_items_and_totals(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=10)
    b = await mk_item(client, h, stock=10)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(a["id"], 2)])

    resp = await client.put(f"/sales/orders/{so['id']}", json={
        "items": [{"item_id": b["id"], "quantity": 3, "unit_price": 50, "tax_rate": 10}],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert [(i["item_id"], i["quantity"]) for i in body["items"]] == [(b["id"], 3)]
    assert body["total_amount"] == pytest.approx(165)

    fetched = (await client.get(f"/sales/orders/{so['id']}", headers=h)).json()
    assert [(i["item_id"], i["quantity"]) for i in fetched["items"]] == [(b["id"], 3)]
    assert fetched["total_amount"] == pytest.approx(165)


@pytest.mark.asyncio
async def test_so_rejects_unknown_customer_and_item(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=1)
    resp = await client.post("/sales/orders", json={
        "customer_id": 999999, "items": [{"item_id": item["id"], "quantity": 1, "unit_price": 1}],
    }, headers=h)
    assert resp.status_code == 404
    cust = await mk_party(client, h)
    resp = await client.post("/sales/orders", json={
        "customer_id": cust["id"], "items": [{"item_id": 999999, "quantity": 1, "unit_price": 1}],
    }, headers=h)
    assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════
# B. Purchase Order ↔ Inward (GRN) ↔ Inventory
# ══════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_partial_grn_does_not_complete_po(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    b = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10), (b["id"], 5)])

    resp = await grn(client, h, po["id"], [(a["id"], 10)])
    assert resp.status_code == 200, resp.text
    po_now = (await client.get(f"/purchases/orders/{po['id']}", headers=h)).json()
    assert po_now["status"] == "partial"
    # Goods are not fully in — the UI keeps "Create Inward" enabled.
    assert po_now["goods_status"] == "not_received"
    assert await stock_of(client, h, a["id"]) == pytest.approx(10)

    resp = await grn(client, h, po["id"], [(b["id"], 5)])
    assert resp.status_code == 200, resp.text
    po_now = (await client.get(f"/purchases/orders/{po['id']}", headers=h)).json()
    assert po_now["status"] == "completed"
    assert po_now["goods_status"] == "received"
    assert await stock_of(client, h, b["id"]) == pytest.approx(5)
    await assert_ledger_consistent(client, h, a)
    await assert_ledger_consistent(client, h, b)


@pytest.mark.asyncio
async def test_grn_over_receipt_is_rejected(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])

    assert (await grn(client, h, po["id"], [(a["id"], 12)])).status_code == 409
    assert (await grn(client, h, po["id"], [(a["id"], 6)])).status_code == 200
    assert (await grn(client, h, po["id"], [(a["id"], 5)])).status_code == 409
    assert (await grn(client, h, po["id"], [(a["id"], 4)])).status_code == 200
    assert await stock_of(client, h, a["id"]) == pytest.approx(10)


@pytest.mark.asyncio
async def test_grn_validations(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    other = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])

    # Item not on the PO
    assert (await grn(client, h, po["id"], [(other["id"], 1)])).status_code == 409
    # Accepted + rejected must equal received
    resp = await client.post("/purchases/grn", json={
        "po_id": po["id"], "grn_number": f"GRN-E2E-{_uid()}",
        "items": [{"item_id": a["id"], "received_quantity": 4,
                   "accepted_quantity": 5, "rejected_quantity": 0}],
    }, headers=h)
    assert resp.status_code in (409, 422)
    # Duplicate GRN number
    number = f"GRN-E2E-{_uid()}"
    assert (await grn(client, h, po["id"], [(a["id"], 1)], number)).status_code == 200
    assert (await grn(client, h, po["id"], [(a["id"], 1)], number)).status_code == 409
    # Unknown PO
    assert (await grn(client, h, 999999, [(a["id"], 1)])).status_code == 404
    assert await stock_of(client, h, a["id"]) == pytest.approx(1)


@pytest.mark.asyncio
async def test_grn_on_cancelled_po_is_rejected(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])
    await client.post(f"/purchases/orders/{po['id']}/cancel", headers=h)
    assert (await grn(client, h, po["id"], [(a["id"], 5)])).status_code == 409
    assert await stock_of(client, h, a["id"]) == pytest.approx(0)


@pytest.mark.asyncio
async def test_po_edit_preserves_received_quantities(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])
    assert (await grn(client, h, po["id"], [(a["id"], 4)])).status_code == 200

    # The UI edit screen re-sends all items.
    resp = await client.put(f"/purchases/orders/{po['id']}", json={
        "notes": "edited",
        "items": [{"item_id": a["id"], "ordered_quantity": 12, "unit_price": 10}],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    line = resp.json()["items"][0]
    assert line["ordered_quantity"] == pytest.approx(12)
    assert line["received_quantity"] == pytest.approx(4)

    # Ordered below already-received is rejected.
    resp = await client.put(f"/purchases/orders/{po['id']}", json={
        "items": [{"item_id": a["id"], "ordered_quantity": 3, "unit_price": 10}],
    }, headers=h)
    assert resp.status_code == 409

    # Remaining 8 can still be received; no more.
    assert (await grn(client, h, po["id"], [(a["id"], 9)])).status_code == 409
    assert (await grn(client, h, po["id"], [(a["id"], 8)])).status_code == 200
    assert await stock_of(client, h, a["id"]) == pytest.approx(12)


@pytest.mark.asyncio
async def test_cancel_po_after_partial_grn_reverses_stock(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=3, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])
    assert (await grn(client, h, po["id"], [(a["id"], 4)])).status_code == 200
    assert await stock_of(client, h, a["id"]) == pytest.approx(7)

    resp = await client.post(f"/purchases/orders/{po['id']}/cancel", headers=h)
    assert resp.status_code == 200, resp.text
    assert await stock_of(client, h, a["id"]) == pytest.approx(3)
    await assert_ledger_consistent(client, h, a)


@pytest.mark.asyncio
async def test_cancel_via_status_update_also_reverses_stock(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])
    assert (await grn(client, h, po["id"], [(a["id"], 4)])).status_code == 200

    resp = await client.put(f"/purchases/orders/{po['id']}", json={"status": "cancelled"}, headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"
    assert await stock_of(client, h, a["id"]) == pytest.approx(0)
    await assert_ledger_consistent(client, h, a)


@pytest.mark.asyncio
async def test_po_rejects_unknown_supplier_and_item(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0)
    resp = await client.post("/purchases/orders", json={
        "po_number": f"PO-E2E-{_uid()}", "supplier_id": 999999,
        "items": [{"item_id": a["id"], "ordered_quantity": 1, "unit_price": 1}],
    }, headers=h)
    assert resp.status_code == 404
    sup = await mk_party(client, h, "supplier")
    resp = await client.post("/purchases/orders", json={
        "po_number": f"PO-E2E-{_uid()}", "supplier_id": sup["id"],
        "items": [{"item_id": 999999, "ordered_quantity": 1, "unit_price": 1}],
    }, headers=h)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_purchase_dashboard_excludes_cancelled_and_buyer_documents(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    real = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 100000)])
    await client.post(f"/purchases/orders/{po['id']}/cancel", headers=h)
    # A buyer-side invoice is not a purchase either.
    await client.post("/purchases/orders", json={
        "supplier_id": sup["id"], "document_type": "invoice",
        "items": [{"item_id": a["id"], "ordered_quantity": 100000, "unit_price": 10}],
    }, headers=h)
    await mk_po(client, h, sup["id"], [(real["id"], 50000)])

    dash = (await client.get("/inventory/dashboard", headers=h)).json()
    top = [t["item_id"] for t in dash["top_purchased_items"]]
    assert real["id"] in top
    assert a["id"] not in top


# ══════════════════════════════════════════════════════════════════════════
# C. Sales Order → Work Order → Production → Dispatch
# ══════════════════════════════════════════════════════════════════════════

async def _bom_setup(client, h, rm_stock: float = 100, fg_stock: float = 0):
    rm = await mk_item(client, h, stock=rm_stock, category="raw_material", buy_sell="buy")
    fg = await mk_item(client, h, stock=fg_stock, category="finished_good", buy_sell="sell")
    resp = await client.post("/production/boms", json={
        "bom_name": f"E2E BOM {_uid()}", "fg_item_id": fg["id"], "status": "published",
        "items": [{"item_id": rm["id"], "quantity": 2}],
    }, headers=h)
    assert resp.status_code == 200, resp.text
    return rm, fg, resp.json()


@pytest.mark.asyncio
async def test_make_to_order_flow_stays_in_sync(client, admin_headers):
    h = admin_headers
    rm, fg, _ = await _bom_setup(client, h)
    cust = await mk_party(client, h)

    so = await mk_so(client, h, cust["id"], [(fg["id"], 5)])
    resp = await client.post("/production/work-orders", json={
        "item_id": fg["id"], "quantity": 5, "buyer_id": cust["id"],
        "document_number": so["order_number"], "order_type": "sales_order",
    }, headers=h)
    assert resp.status_code == 200, resp.text
    wo = resp.json()

    resp = await client.post(f"/production/work-orders/{wo['id']}/start", headers=h)
    assert resp.status_code == 200, resp.text
    pp = resp.json()
    assert pp["bom_id"] is not None

    resp = await client.post(f"/production/processes/{pp['id']}/complete", json={}, headers=h)
    assert resp.status_code == 200, resp.text
    pp = resp.json()
    assert pp["stage"] == "completed"
    assert pp["linked_sales_order_id"] == so["id"]

    # BOM: 2 RM per FG → 10 RM consumed, 5 FG produced.
    assert await stock_of(client, h, rm["id"]) == pytest.approx(90)
    assert await stock_of(client, h, fg["id"]) == pytest.approx(5)
    wo_now = (await client.get(f"/production/work-orders/{wo['id']}", headers=h)).json()
    assert wo_now["process_stage"] == "completed"

    # Now the order can be confirmed and shipped from the production line.
    resp = await client.post(f"/sales/orders/{so['id']}/confirm", headers=h)
    assert resp.status_code == 200, resp.text

    ready = (await client.get("/dispatch/production-ready", headers=h)).json()["items"]
    entry = next(r for r in ready if r["process_id"] == pp["id"])
    assert entry["linked_sales_order_id"] == so["id"]

    # The UI dispatches from production passing only the process id.
    d = await mk_dispatch(client, h, [(fg["id"], 5)], process_id=pp["id"])
    assert d["sales_order_id"] == so["id"], "dispatch should be linked to the work order's sales order"
    await client.post(f"/dispatch/dispatches/{d['id']}/pack", headers=h)
    await client.post(f"/dispatch/dispatches/{d['id']}/ship", headers=h)

    assert await so_status(client, h, so["id"]) == "shipped"
    assert await stock_of(client, h, fg["id"]) == pytest.approx(0)
    pp_now = (await client.get(f"/production/processes/{pp['id']}", headers=h)).json()
    assert pp_now["linked_dispatch_status"] == "shipped"
    ready = (await client.get("/dispatch/production-ready", headers=h)).json()["items"]
    assert pp["id"] not in [r["process_id"] for r in ready]

    for it in (rm, fg):
        await assert_ledger_consistent(client, h, it)


@pytest.mark.asyncio
async def test_completing_process_via_update_syncs_inventory(client, admin_headers):
    h = admin_headers
    rm, fg, bom = await _bom_setup(client, h)
    resp = await client.post("/production/work-orders", json={
        "item_id": fg["id"], "quantity": 4,
    }, headers=h)
    wo = resp.json()
    pp = (await client.post(f"/production/work-orders/{wo['id']}/start", headers=h)).json()

    resp = await client.put(f"/production/processes/{pp['id']}", json={"stage": "completed"}, headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "completed"
    assert await stock_of(client, h, rm["id"]) == pytest.approx(92)
    assert await stock_of(client, h, fg["id"]) == pytest.approx(4)
    wo_now = (await client.get(f"/production/work-orders/{wo['id']}", headers=h)).json()
    assert wo_now["process_stage"] == "completed"
    for it in (rm, fg):
        await assert_ledger_consistent(client, h, it)


@pytest.mark.asyncio
async def test_materials_cannot_be_issued_twice_or_after_completion(client, admin_headers):
    h = admin_headers
    rm, fg, bom = await _bom_setup(client, h)
    resp = await client.post("/production/processes", json={
        "fg_item_id": fg["id"], "bom_id": bom["id"], "target_quantity": 3,
    }, headers=h)
    pp = resp.json()

    assert (await client.post(f"/production/processes/{pp['id']}/issue-from-bom", headers=h)).status_code == 200
    assert await stock_of(client, h, rm["id"]) == pytest.approx(94)
    assert (await client.post(f"/production/processes/{pp['id']}/issue-from-bom", headers=h)).status_code == 409

    assert (await client.post(f"/production/processes/{pp['id']}/complete", json={}, headers=h)).status_code == 200
    resp = await client.post("/production/processes/issue-items", json={
        "process_id": pp["id"],
        "items": [{"item_id": rm["id"], "required_quantity": 1, "issued_quantity": 1}],
    }, headers=h)
    assert resp.status_code == 409
    assert await stock_of(client, h, rm["id"]) == pytest.approx(94)
    assert await stock_of(client, h, fg["id"]) == pytest.approx(3)


@pytest.mark.asyncio
async def test_bom_rejects_unknown_items(client, admin_headers):
    h = admin_headers
    fg = await mk_item(client, h, stock=0)
    resp = await client.post("/production/boms", json={
        "bom_name": "bad", "fg_item_id": 999999, "items": [],
    }, headers=h)
    assert resp.status_code == 404
    resp = await client.post("/production/boms", json={
        "bom_name": "bad", "fg_item_id": fg["id"], "items": [{"item_id": 999999, "quantity": 1}],
    }, headers=h)
    assert resp.status_code == 404
    resp = await client.post("/production/boms", json={
        "bom_name": "self", "fg_item_id": fg["id"], "items": [{"item_id": fg["id"], "quantity": 1}],
    }, headers=h)
    assert resp.status_code == 409


# ══════════════════════════════════════════════════════════════════════════
# D. Parties ↔ Locations ↔ Documents
# ══════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_viewing_party_does_not_destroy_soft_deleted_locations(client, admin_headers):
    h = admin_headers
    party = await mk_party(client, h, "supplier")
    keep = (await client.post(f"/parties/{party['id']}/locations", json={
        "location_type": "billing", "address_line1": "1 Keep St", "city": "Pune",
    }, headers=h)).json()
    gone = (await client.post(f"/parties/{party['id']}/locations", json={
        "location_type": "shipping", "address_line1": "2 Gone St", "city": "Pune",
    }, headers=h)).json()

    # A PO still references the location that is about to be removed.
    item = await mk_item(client, h, stock=0)
    resp = await client.post("/purchases/orders", json={
        "po_number": f"PO-E2E-{_uid()}", "supplier_id": party["id"],
        "billing_location_id": gone["id"],
        "items": [{"item_id": item["id"], "ordered_quantity": 1, "unit_price": 1}],
    }, headers=h)
    assert resp.status_code == 200, resp.text

    resp = await client.delete(f"/parties/{party['id']}/locations/{gone['id']}", headers=h)
    assert resp.status_code == 204

    for _ in range(2):
        resp = await client.get(f"/parties/{party['id']}", headers=h)
        assert resp.status_code == 200, resp.text
        assert [loc["id"] for loc in resp.json()["locations"]] == [keep["id"]]

    resp = await client.get("/parties/", params={"party_type": "supplier", "search": party["name"]}, headers=h)
    listed = next(p for p in resp.json()["parties"] if p["id"] == party["id"])
    assert [loc["id"] for loc in listed["locations"]] == [keep["id"]]

    # The soft-deleted row must still exist (it's referenced by the PO).
    async with async_session() as s:
        row = (await s.execute(select(Location).where(Location.id == gone["id"]))).scalar_one_or_none()
        assert row is not None and row.is_deleted is True


@pytest.mark.asyncio
async def test_only_one_default_location_per_type(client, admin_headers):
    h = admin_headers
    party = await mk_party(client, h)
    first = (await client.post(f"/parties/{party['id']}/locations", json={
        "location_type": "delivery", "address_line1": "A", "city": "X", "is_default": True,
    }, headers=h)).json()
    second = (await client.post(f"/parties/{party['id']}/locations", json={
        "location_type": "delivery", "address_line1": "B", "city": "X", "is_default": True,
    }, headers=h)).json()
    locs = (await client.get(f"/parties/{party['id']}/locations", headers=h)).json()
    defaults = [l["id"] for l in locs if l["location_type"] == "delivery" and l["is_default"]]
    assert defaults == [second["id"]]

    resp = await client.patch(f"/parties/{party['id']}/locations/{first['id']}",
                              json={"is_default": True}, headers=h)
    assert resp.status_code == 200
    locs = (await client.get(f"/parties/{party['id']}/locations", headers=h)).json()
    defaults = [l["id"] for l in locs if l["location_type"] == "delivery" and l["is_default"]]
    assert defaults == [first["id"]]


@pytest.mark.asyncio
async def test_party_sub_resources_are_scoped_to_their_party(client, admin_headers):
    h = admin_headers
    p1 = await mk_party(client, h)
    p2 = await mk_party(client, h)
    loc = (await client.post(f"/parties/{p1['id']}/locations", json={
        "location_type": "billing", "address_line1": "A", "city": "X",
    }, headers=h)).json()

    resp = await client.patch(f"/parties/{p2['id']}/locations/{loc['id']}", json={"city": "Hacked"}, headers=h)
    assert resp.status_code == 404
    resp = await client.post("/parties/999999/locations", json={
        "location_type": "billing", "address_line1": "A", "city": "X",
    }, headers=h)
    assert resp.status_code == 404
    fresh = (await client.get(f"/parties/{p1['id']}", headers=h)).json()
    assert fresh["locations"][0]["city"] == "X"


@pytest.mark.asyncio
async def test_deleting_party_with_documents_is_rejected(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=5)
    cust = await mk_party(client, h)
    await mk_so(client, h, cust["id"], [(item["id"], 1)])
    resp = await client.delete(f"/parties/{cust['id']}", headers=h)
    assert resp.status_code == 409, resp.text
    assert (await client.get(f"/parties/{cust['id']}", headers=h)).status_code == 200


@pytest.mark.asyncio
async def test_sales_dashboard_counts_only_real_sales(client, admin_headers):
    h = admin_headers
    item = await mk_item(client, h, stock=1000)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 900)])  # draft, huge value
    await client.delete(f"/sales/orders/{so['id']}", headers=h)    # and cancelled
    sold = await mk_item(client, h, stock=1000)
    await mk_so(client, h, cust["id"], [(sold["id"], 800)], confirm=True)
    dash = (await client.get("/inventory/dashboard", headers=h)).json()
    top = [t["item_id"] for t in dash["top_selling_items"]]
    assert sold["id"] in top
    assert item["id"] not in top


# ══════════════════════════════════════════════════════════════════════════
# E. Guard rails that keep modules consistent
# ══════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_dispatched_production_output_leaves_ready_list(client, admin_headers):
    h = admin_headers
    rm, fg, bom = await _bom_setup(client, h)
    pp = (await client.post("/production/processes", json={
        "fg_item_id": fg["id"], "bom_id": bom["id"], "target_quantity": 2,
    }, headers=h)).json()
    await client.post(f"/production/processes/{pp['id']}/complete", json={}, headers=h)

    ready = (await client.get("/dispatch/production-ready", headers=h)).json()["items"]
    entry = next(r for r in ready if r["process_id"] == pp["id"])
    assert entry["remaining_quantity"] == pytest.approx(2)

    d = await mk_dispatch(client, h, [(fg["id"], 2)], process_id=pp["id"])
    assert d["sales_order_id"] is None  # no work order → direct dispatch
    assert d["production_process_id"] == pp["id"]
    ready = (await client.get("/dispatch/production-ready", headers=h)).json()["items"]
    assert pp["id"] not in [r["process_id"] for r in ready]


@pytest.mark.asyncio
async def test_cancelling_process_returns_issued_materials(client, admin_headers):
    h = admin_headers
    rm, fg, bom = await _bom_setup(client, h)
    wo = (await client.post("/production/work-orders", json={"item_id": fg["id"], "quantity": 5}, headers=h)).json()
    pp = (await client.post(f"/production/work-orders/{wo['id']}/start", headers=h)).json()
    await client.post(f"/production/processes/{pp['id']}/issue-from-bom", headers=h)
    assert await stock_of(client, h, rm["id"]) == pytest.approx(90)

    resp = await client.put(f"/production/processes/{pp['id']}", json={"stage": "cancelled"}, headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "cancelled"
    assert await stock_of(client, h, rm["id"]) == pytest.approx(100)
    assert await stock_of(client, h, fg["id"]) == pytest.approx(0)
    wo_now = (await client.get(f"/production/work-orders/{wo['id']}", headers=h)).json()
    assert wo_now["process_stage"] == "open"

    # A cancelled process is frozen.
    resp = await client.post(f"/production/processes/{pp['id']}/complete", json={}, headers=h)
    assert resp.status_code == 409
    await assert_ledger_consistent(client, h, rm)


@pytest.mark.asyncio
async def test_work_order_with_process_cannot_be_deleted(client, admin_headers):
    h = admin_headers
    rm, fg, _ = await _bom_setup(client, h)
    wo = (await client.post("/production/work-orders", json={"item_id": fg["id"], "quantity": 1}, headers=h)).json()
    await client.post(f"/production/work-orders/{wo['id']}/start", headers=h)
    assert (await client.delete(f"/production/work-orders/{wo['id']}", headers=h)).status_code == 409

    fresh = (await client.post("/production/work-orders", json={"item_id": fg["id"], "quantity": 1}, headers=h)).json()
    assert (await client.delete(f"/production/work-orders/{fresh['id']}", headers=h)).status_code == 204


@pytest.mark.asyncio
async def test_cannot_cancel_po_whose_received_stock_was_consumed(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=0, category="raw_material")
    sup = await mk_party(client, h, "supplier")
    po = await mk_po(client, h, sup["id"], [(a["id"], 10)])
    assert (await grn(client, h, po["id"], [(a["id"], 6)])).status_code == 200
    resp = await client.post("/inventory/transactions", json={
        "item_id": a["id"], "transaction_type": "out", "quantity": 5,
    }, headers=h)
    assert resp.status_code == 200, resp.text

    resp = await client.post(f"/purchases/orders/{po['id']}/cancel", headers=h)
    assert resp.status_code == 409
    assert await stock_of(client, h, a["id"]) == pytest.approx(1)
    await assert_ledger_consistent(client, h, a)


@pytest.mark.asyncio
async def test_stock_transactions_validate_quantity(client, admin_headers):
    h = admin_headers
    a = await mk_item(client, h, stock=5)
    for tx_type, qty in (("in", 0), ("in", -3), ("out", -1), ("adjustment", -1)):
        resp = await client.post("/inventory/transactions", json={
            "item_id": a["id"], "transaction_type": tx_type, "quantity": qty,
        }, headers=h)
        assert resp.status_code == 409, (tx_type, qty, resp.text)
    resp = await client.post("/inventory/transactions", json={
        "item_id": a["id"], "transaction_type": "adjustment", "quantity": 8,
    }, headers=h)
    assert resp.status_code == 200
    assert await stock_of(client, h, a["id"]) == pytest.approx(8)
    await assert_ledger_consistent(client, h, a)


@pytest.mark.asyncio
async def test_mark_shipped_ships_outstanding_and_respects_packed_dispatches(client, admin_headers):
    """The Sales Order page's "Mark Shipped" button on a partially packed order."""
    h = admin_headers
    item = await mk_item(client, h, stock=20)
    cust = await mk_party(client, h)
    so = await mk_so(client, h, cust["id"], [(item["id"], 10)], confirm=True)
    packed = await mk_dispatch(client, h, [(item["id"], 4)], so_id=so["id"])
    await client.post(f"/dispatch/dispatches/{packed['id']}/pack", headers=h)
    draft = await mk_dispatch(client, h, [(item["id"], 3)], so_id=so["id"])
    assert await so_status(client, h, so["id"]) == "processing"
    assert await stock_of(client, h, item["id"]) == pytest.approx(16)

    resp = await client.post(f"/sales/orders/{so['id']}/ship", headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "shipped"

    # 4 already left with the packed dispatch; the other 6 leave now — 10 in total.
    assert await stock_of(client, h, item["id"]) == pytest.approx(10)
    assert (await client.get(f"/dispatch/dispatches/{packed['id']}", headers=h)).json()["status"] == "shipped"
    assert (await client.get(f"/dispatch/dispatches/{draft['id']}", headers=h)).json()["status"] == "cancelled"
    await assert_ledger_consistent(client, h, item)
