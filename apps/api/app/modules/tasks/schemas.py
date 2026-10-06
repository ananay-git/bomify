"""
Pydantic schemas for staff tasks.
"""

from collections.abc import Sequence
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.modules.tasks.models import TaskStatus


class AssignTaskRequest(BaseModel):
    """Send a production order to staff. Give the work order OR the process."""

    work_order_id: int | None = None
    process_id: int | None = None
    note: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def _exactly_one_target(self):
        if (self.work_order_id is None) == (self.process_id is None):
            raise ValueError("Provide either work_order_id or process_id")
        return self


class CompleteTaskRequest(BaseModel):
    """Staff mark the order done. Quantity defaults to the full target."""

    completed_quantity: float | None = Field(None, gt=0)
    note: str | None = Field(None, max_length=1000)


class TaskMaterial(BaseModel):
    item_name: str | None = None
    item_sku: str | None = None
    unit_of_measure: str | None = None
    quantity: float


class TaskResponse(BaseModel):
    id: int
    status: TaskStatus
    process_id: int
    process_number: str
    work_order_id: int | None = None
    order_number: str | None = None
    item_name: str | None = None
    item_sku: str | None = None
    uom: str | None = None
    target_quantity: float
    completed_quantity: float | None = None
    delivery_date: datetime | None = None
    note: str | None = None
    assigned_by_name: str | None = None
    assigned_at: datetime
    completed_by_name: str | None = None
    completed_at: datetime | None = None
    completion_note: str | None = None
    materials: list[TaskMaterial] = []


class TaskListResponse(BaseModel):
    tasks: Sequence[TaskResponse]
    total: int


class StaffDashboardResponse(BaseModel):
    todo: Sequence[TaskResponse]
    done: Sequence[TaskResponse]


class AssignTaskResponse(BaseModel):
    task: TaskResponse
    # How many staff accounts were notified (0 means there are no active staff yet)
    notified_staff: int
