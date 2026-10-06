"""
Production Pydantic schemas.
BOM, Work Orders, Production Processes, and Sub Contracts.
"""
from typing import Sequence
from datetime import datetime
from pydantic import BaseModel, Field
from app.modules.production.models import (
    BOMStatus, WorkOrderStage, ProcessStage, ProcessStatus, ProcessType,
    SubContractStage, SubContractStatus,
)


# ─── BOM ─────────────────────────────────────────────────────────────────────

class BOMItemCreate(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)


class BOMItemResponse(BaseModel):
    id: int
    item_id: int
    quantity: float
    # Populated by service via join
    item_name: str | None = None
    item_sku: str | None = None
    unit_of_measure: str | None = None
    model_config = {"from_attributes": True}


class BOMCreate(BaseModel):
    bom_name: str = Field(min_length=1, max_length=200)
    fg_item_id: int
    status: BOMStatus = BOMStatus.DRAFT
    items: list[BOMItemCreate] = []


class BOMUpdate(BaseModel):
    bom_name: str | None = None
    fg_item_id: int | None = None
    status: BOMStatus | None = None
    items: list[BOMItemCreate] | None = None


class BOMResponse(BaseModel):
    id: int
    bom_id: str
    bom_name: str
    fg_item_id: int
    fg_name: str | None = None
    fg_uom: str | None = None
    status: BOMStatus
    num_rm: int = 0
    last_modified_by: str | None
    created_at: datetime
    updated_at: datetime
    items: list[BOMItemResponse] = []
    model_config = {"from_attributes": True}


class BOMListResponse(BaseModel):
    boms: Sequence[BOMResponse]
    total: int


# ─── Work Orders ─────────────────────────────────────────────────────────────

class WorkOrderCreate(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)
    buyer_id: int | None = None
    document_number: str | None = None
    order_type: str | None = None
    delivery_date: datetime | None = None
    document_date: datetime | None = None


class WorkOrderUpdate(BaseModel):
    quantity: float | None = None
    buyer_id: int | None = None
    document_number: str | None = None
    order_type: str | None = None
    process_stage: WorkOrderStage | None = None
    delivery_date: datetime | None = None
    document_date: datetime | None = None


class WorkOrderResponse(BaseModel):
    id: int
    item_id: int
    item_name: str | None = None
    item_sku: str | None = None
    uom: str | None = None
    quantity: float
    buyer_id: int | None
    buyer_name: str | None = None
    document_number: str | None
    order_type: str | None
    process_number: str | None
    process_stage: WorkOrderStage
    delivery_date: datetime | None
    document_date: datetime | None
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    orders: Sequence[WorkOrderResponse]
    total: int


# ─── Production Process ──────────────────────────────────────────────────────

class ProductionProcessCreate(BaseModel):
    work_order_id: int | None = None
    bom_id: int | None = None
    fg_item_id: int
    target_quantity: float = Field(gt=0)
    process_type: ProcessType = ProcessType.MASTER
    order_delivery_date: datetime | None = None
    expected_completion_date: datetime | None = None


class ProductionProcessUpdate(BaseModel):
    stage: ProcessStage | None = None
    status: ProcessStatus | None = None
    completed_quantity: float | None = None
    expected_completion_date: datetime | None = None


class IssuedItemCreate(BaseModel):
    item_id: int
    required_quantity: float = Field(gt=0)
    issued_quantity: float = 0.0


class IssuedItemResponse(BaseModel):
    id: int
    item_id: int
    item_name: str | None = None
    item_sku: str | None = None
    required_quantity: float
    issued_quantity: float
    created_at: datetime
    model_config = {"from_attributes": True}


class ProductionProcessResponse(BaseModel):
    id: int
    reference_number: str | None
    process_number: str
    stage: ProcessStage
    status: ProcessStatus
    bom_id: int | None
    bom_number: str | None = None
    work_order_id: int | None
    fg_item_id: int
    fg_name: str | None = None
    fg_uom: str | None = None
    process_type: ProcessType

    target_quantity: float
    completed_quantity: float

    order_delivery_date: datetime | None
    expected_completion_date: datetime | None

    last_modified_by: str | None
    created_at: datetime
    updated_at: datetime

    issued_items: list[IssuedItemResponse] = []
    dispatch_ready: bool = False
    linked_sales_order_id: int | None = None
    model_config = {"from_attributes": True}


class ProductionProcessListResponse(BaseModel):
    processes: Sequence[ProductionProcessResponse]
    total: int


class IssueItemsRequest(BaseModel):
    """Issue raw materials from BOM for a production process."""
    process_id: int
    items: list[IssuedItemCreate] = []


class CompleteProcessRequest(BaseModel):
    """Mark a production process as complete."""
    completed_quantity: float | None = Field(None, gt=0)


# ─── Sub Contract ────────────────────────────────────────────────────────────

class SubContractCreate(BaseModel):
    job_work_number: str | None = None
    fg_item_id: int
    target_quantity: float = Field(gt=0)


class SubContractUpdate(BaseModel):
    stage: SubContractStage | None = None
    status: SubContractStatus | None = None
    completed_quantity: float | None = None
    job_work_number: str | None = None


class SubContractResponse(BaseModel):
    id: int
    process_number: str
    job_work_number: str | None
    stage: SubContractStage
    status: SubContractStatus
    fg_item_id: int
    fg_name: str | None = None
    fg_uom: str | None = None
    target_quantity: float
    completed_quantity: float
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SubContractListResponse(BaseModel):
    sub_contracts: Sequence[SubContractResponse]
    total: int
