"""
Business logic for staff tasks.

The loop this module drives:

    owner assigns an order  ->  every staff member is notified (browser + email)
    staff finish it and tick "done"  ->  the production process is completed,
    the order becomes ready for dispatch  ->  every owner is notified
    (browser + email) with a link straight to the dispatch screen.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.inventory.models import Item
from app.modules.notifications import services as notification_service
from app.modules.notifications.email import EmailMessage
from app.modules.production.models import (
    BOMItem,
    ProcessStage,
    ProductionProcess,
    WorkOrder,
    WorkOrderStage,
)
from app.modules.production.services import (
    ProductionProcessService,
    WorkOrderService,
)
from app.modules.tasks.models import StaffTask, TaskStatus
from app.modules.tasks.schemas import AssignTaskRequest, CompleteTaskRequest
from app.modules.users.models import User, UserRole

# How many finished tasks staff see under "Recently done"
_RECENT_DONE_LIMIT = 20


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _fmt_qty(value: float) -> str:
    """50.0 -> '50', 48.5 -> '48.5' (never scientific notation)."""
    return format(float(value), "f").rstrip("0").rstrip(".") or "0"


def _effective_status(task: StaffTask, process: ProductionProcess) -> TaskStatus:
    """The status staff should see.

    If the owner finished or cancelled the production process directly from the
    Production page, the task follows it so it never gets stuck on the list.
    """
    if task.status == TaskStatus.ASSIGNED:
        if process.stage == ProcessStage.COMPLETED:
            return TaskStatus.READY_FOR_DISPATCH
        if process.stage == ProcessStage.CANCELLED:
            return TaskStatus.CANCELLED
    return task.status


def _dispatch_link(process_id: int, linked_sales_order_id: int | None) -> str:
    """Same destination the Production page's "Start Dispatch" button uses."""
    if linked_sales_order_id:
        return f"/app/dispatch/create?so_id={linked_sales_order_id}"
    return f"/app/dispatch/create?process_id={process_id}"


async def _serialize(
    db: AsyncSession, task: StaffTask, *, include_materials: bool = True
) -> dict:
    """Task + the order details staff need (item, quantity, due date, materials)."""
    process = await db.get(ProductionProcess, task.process_id)
    fg = await db.get(Item, process.fg_item_id)
    work_order = await db.get(WorkOrder, task.work_order_id) if task.work_order_id else None
    status = _effective_status(task, process)

    materials: list[dict] = []
    if include_materials and process.bom_id and status == TaskStatus.ASSIGNED:
        rows = await db.execute(
            select(BOMItem).where(BOMItem.bom_id == process.bom_id).order_by(BOMItem.id)
        )
        for bom_item in rows.scalars().all():
            material = await db.get(Item, bom_item.item_id)
            materials.append(
                {
                    "item_name": material.name if material else None,
                    "item_sku": material.sku if material else None,
                    "unit_of_measure": material.unit_of_measure if material else None,
                    "quantity": round(
                        float(bom_item.quantity) * float(process.target_quantity), 2
                    ),
                }
            )

    completed_quantity = None
    if status == TaskStatus.READY_FOR_DISPATCH:
        completed_quantity = float(
            task.completed_quantity
            if task.completed_quantity is not None
            else process.completed_quantity
        )

    return {
        "id": task.id,
        "status": status,
        "process_id": process.id,
        "process_number": process.process_number,
        "work_order_id": task.work_order_id,
        "order_number": work_order.document_number if work_order else None,
        "item_name": fg.name if fg else None,
        "item_sku": fg.sku if fg else None,
        "uom": fg.unit_of_measure if fg else None,
        "target_quantity": float(process.target_quantity),
        "completed_quantity": completed_quantity,
        "delivery_date": process.order_delivery_date
        or (work_order.delivery_date if work_order else None),
        "note": task.note,
        "assigned_by_name": task.assigned_by_name,
        "assigned_at": task.assigned_at,
        "completed_by_name": task.completed_by_name,
        "completed_at": task.completed_at,
        "completion_note": task.completion_note,
        "materials": materials,
    }


# ─── Owner: assign / list / withdraw ─────────────────────────────────────────


async def assign_task(
    db: AsyncSession, *, data: AssignTaskRequest, owner: User
) -> tuple[dict, int, list[EmailMessage]]:
    """Send an order to staff.

    Returns (task, how many staff were notified, emails to send in the background).
    """
    work_order: WorkOrder | None = None

    if data.work_order_id is not None:
        work_order = await db.get(WorkOrder, data.work_order_id)
        if not work_order:
            raise NotFoundError("Work order not found")
        if work_order.process_stage == WorkOrderStage.COMPLETED:
            raise ConflictError("This work order is already completed")
        if work_order.process_stage == WorkOrderStage.CANCELLED:
            raise ConflictError("This work order was cancelled")

        if work_order.process_stage == WorkOrderStage.OPEN:
            # Production hasn't started — start it so staff have a process to work on.
            started = await WorkOrderService.start_process(
                db, work_order.id, owner.full_name
            )
            process = await db.get(ProductionProcess, started["id"])
        else:
            result = await db.execute(
                select(ProductionProcess)
                .where(ProductionProcess.work_order_id == work_order.id)
                .order_by(ProductionProcess.id.desc())
                .limit(1)
            )
            process = result.scalar_one_or_none()
            if not process:
                raise ConflictError("This work order has no production process yet")
    else:
        process = await db.get(ProductionProcess, data.process_id)
        if not process:
            raise NotFoundError("Production process not found")
        if process.work_order_id:
            work_order = await db.get(WorkOrder, process.work_order_id)

    if process.stage == ProcessStage.COMPLETED:
        raise ConflictError("This order is already completed")
    if process.stage == ProcessStage.CANCELLED:
        raise ConflictError("This order was cancelled")

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(StaffTask).where(StaffTask.process_id == process.id).with_for_update()
    )
    task = result.scalar_one_or_none()
    if task:
        if task.status == TaskStatus.ASSIGNED:
            raise ConflictError("This order is already assigned to staff")
        if task.status == TaskStatus.READY_FOR_DISPATCH:
            raise ConflictError("Staff have already finished this order")
        # Withdrawn earlier — send it out again from scratch.
        task.status = TaskStatus.ASSIGNED
        task.note = data.note
        task.assigned_by_id = owner.id
        task.assigned_by_name = owner.full_name
        task.assigned_at = now
        task.completed_by_id = None
        task.completed_by_name = None
        task.completed_at = None
        task.completed_quantity = None
        task.completion_note = None
    else:
        task = StaffTask(
            process_id=process.id,
            work_order_id=work_order.id if work_order else None,
            status=TaskStatus.ASSIGNED,
            note=data.note,
            assigned_by_id=owner.id,
            assigned_by_name=owner.full_name,
            assigned_at=now,
        )
        db.add(task)
    await db.flush()

    # Tell every active staff member.
    fg = await db.get(Item, process.fg_item_id)
    item_name = fg.name if fg else "an item"
    qty_text = f"{_fmt_qty(process.target_quantity)} {(fg.unit_of_measure if fg and fg.unit_of_measure else '')}".strip()
    due = process.order_delivery_date or (work_order.delivery_date if work_order else None)

    lines = [
        f"{owner.full_name} assigned a new order: {qty_text} of {item_name} "
        f"({process.process_number})."
    ]
    if due:
        lines.append(f"Due: {due:%d %b %Y}.")
    if data.note:
        lines.append(f"Note from the owner: {data.note}")

    staff = await notification_service.active_users_with_role(db, UserRole.STAFF)
    emails = await notification_service.notify_users(
        db,
        staff,
        kind="task_assigned",
        title=f"New order: {qty_text} {item_name}",
        message="\n".join(lines),
        link="/staff",
    )
    return await _serialize(db, task), len(staff), emails


async def list_tasks_for_owner(
    db: AsyncSession, *, include_cancelled: bool = False, limit: int = 200
) -> list[dict]:
    result = await db.execute(
        select(StaffTask).order_by(StaffTask.id.desc()).limit(limit)
    )
    out: list[dict] = []
    for task in result.scalars().all():
        data = await _serialize(db, task, include_materials=False)
        if data["status"] == TaskStatus.CANCELLED and not include_cancelled:
            continue
        out.append(data)
    return out


async def cancel_task(
    db: AsyncSession, *, task_id: int, owner: User
) -> tuple[dict, list[EmailMessage]]:
    """Withdraw an order that staff haven't finished yet."""
    task = await db.get(StaffTask, task_id)
    if not task:
        raise NotFoundError("Task not found")
    process = await db.get(ProductionProcess, task.process_id)
    if _effective_status(task, process) != TaskStatus.ASSIGNED:
        raise ConflictError("Only orders that are still with staff can be withdrawn")

    task.status = TaskStatus.CANCELLED
    await db.flush()

    fg = await db.get(Item, process.fg_item_id)
    staff = await notification_service.active_users_with_role(db, UserRole.STAFF)
    emails = await notification_service.notify_users(
        db,
        staff,
        kind="task_cancelled",
        title=f"Order withdrawn: {fg.name if fg else process.process_number}",
        message=(
            f"{owner.full_name} withdrew {process.process_number}. "
            "You no longer need to work on it."
        ),
        link="/staff",
        send_email=False,
    )
    return await _serialize(db, task, include_materials=False), emails


# ─── Staff: shared dashboard / finish an order ───────────────────────────────


async def staff_dashboard(db: AsyncSession) -> dict:
    """The one list every staff member sees: what's to do, and what was just done."""
    assigned = (
        await db.execute(
            select(StaffTask)
            .where(StaffTask.status == TaskStatus.ASSIGNED)
            .order_by(StaffTask.assigned_at.asc(), StaffTask.id.asc())
        )
    ).scalars().all()
    finished = (
        await db.execute(
            select(StaffTask)
            .where(StaffTask.status == TaskStatus.READY_FOR_DISPATCH)
            .order_by(StaffTask.completed_at.desc(), StaffTask.id.desc())
            .limit(_RECENT_DONE_LIMIT)
        )
    ).scalars().all()

    todo: list[dict] = []
    done: list[dict] = []
    for task in assigned:
        data = await _serialize(db, task)
        if data["status"] == TaskStatus.ASSIGNED:
            todo.append(data)
        elif data["status"] == TaskStatus.READY_FOR_DISPATCH:
            done.append(data)  # owner finished it directly
        # cancelled via the process -> no longer relevant to staff
    for task in finished:
        done.append(await _serialize(db, task, include_materials=False))

    done.sort(key=lambda d: d["completed_at"] or d["assigned_at"], reverse=True)
    return {"todo": todo, "done": done[:_RECENT_DONE_LIMIT]}


async def complete_task(
    db: AsyncSession, *, task_id: int, data: CompleteTaskRequest, user: User
) -> tuple[dict, list[EmailMessage]]:
    """Staff tick "done": finish the production process and tell the owner.

    Completing the process is what makes the order ready for dispatch — it adds
    the finished goods to stock (and takes the raw materials out if they were
    not issued yet), exactly like the owner's "Mark as Complete" button.
    """
    # Lock the task row so two people pressing "done" together can't both finish it.
    result = await db.execute(
        select(StaffTask).where(StaffTask.id == task_id).with_for_update()
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundError("Task not found")

    process = await db.get(ProductionProcess, task.process_id)
    if task.status == TaskStatus.CANCELLED or process.stage == ProcessStage.CANCELLED:
        raise ConflictError("The owner withdrew this order")
    if task.status == TaskStatus.READY_FOR_DISPATCH:
        raise ConflictError("This order is already marked as done")

    if process.stage == ProcessStage.COMPLETED:
        # The owner already completed it from the Production page — just close the task.
        summary = await ProductionProcessService.get(db, process.id)
    else:
        summary = await ProductionProcessService.complete(
            db, process.id, data.completed_quantity, user.full_name
        )

    task.status = TaskStatus.READY_FOR_DISPATCH
    task.completed_by_id = user.id
    task.completed_by_name = user.full_name
    task.completed_at = datetime.now(timezone.utc)
    task.completed_quantity = summary["completed_quantity"]
    task.completion_note = data.note
    await db.flush()

    # Tell the owner(s) it's ready to dispatch.
    item_name = summary["fg_name"] or summary["process_number"]
    done_qty = _fmt_qty(summary["completed_quantity"])
    target_qty = _fmt_qty(summary["target_quantity"])
    qty_text = f"{done_qty} {summary['fg_uom'] or ''}".strip()
    if done_qty != target_qty:
        qty_text += f" (target was {target_qty})"

    message = (
        f"{user.full_name} finished {summary['process_number']}: "
        f"{qty_text} of {item_name}. It is ready to dispatch."
    )
    if data.note:
        message += f"\nNote from staff: {data.note}"

    owners = await notification_service.active_users_with_role(
        db, UserRole.OWNER, exclude_user_id=user.id
    )
    emails = await notification_service.notify_users(
        db,
        owners,
        kind="task_ready_for_dispatch",
        title=f"Ready for dispatch: {item_name}",
        message=message,
        link=_dispatch_link(process.id, summary.get("linked_sales_order_id")),
    )
    return await _serialize(db, task, include_materials=False), emails
