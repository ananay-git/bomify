"""
API endpoints for staff tasks.

Owner:  POST /tasks/assign, GET /tasks/, POST /tasks/{id}/cancel
Staff:  GET /staff/tasks, POST /staff/tasks/{id}/complete
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.notifications.email import send_emails
from app.modules.tasks import services
from app.modules.tasks.schemas import (
    AssignTaskRequest,
    AssignTaskResponse,
    CompleteTaskRequest,
    StaffDashboardResponse,
    TaskListResponse,
    TaskResponse,
)
from app.modules.users.dependencies import get_current_user, require_owner
from app.modules.users.models import User

# ── Owner side ───────────────────────────────────────────────────────────────

router = APIRouter(prefix="/tasks", tags=["Staff Tasks (Owner)"])


@router.post("/assign", response_model=AssignTaskResponse, status_code=201)
async def assign_task(
    body: AssignTaskRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    owner: User = Depends(require_owner),
):
    """Send an order to staff. Every staff member gets a notification and an email."""
    task, notified, emails = await services.assign_task(db, data=body, owner=owner)
    background_tasks.add_task(send_emails, emails)
    return AssignTaskResponse(task=task, notified_staff=notified)


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    include_cancelled: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """All orders sent to staff, newest first."""
    tasks = await services.list_tasks_for_owner(db, include_cancelled=include_cancelled)
    return TaskListResponse(tasks=tasks, total=len(tasks))


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    owner: User = Depends(require_owner),
):
    """Withdraw an order staff haven't finished yet."""
    task, emails = await services.cancel_task(db, task_id=task_id, owner=owner)
    background_tasks.add_task(send_emails, emails)
    return task


# ── Staff side (staff accounts — owners may use it too) ──────────────────────

staff_router = APIRouter(prefix="/staff", tags=["Staff Dashboard"])


@staff_router.get("/tasks", response_model=StaffDashboardResponse)
async def staff_tasks(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """The shared task list: what is still to do, and what was recently finished."""
    return StaffDashboardResponse(**await services.staff_dashboard(db))


@staff_router.post("/tasks/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    body: CompleteTaskRequest = CompleteTaskRequest(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark an order done and ready for dispatch. The owner is notified."""
    task, emails = await services.complete_task(
        db, task_id=task_id, data=body, user=user
    )
    background_tasks.add_task(send_emails, emails)
    return task
