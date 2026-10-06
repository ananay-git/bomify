"""
Production Router.
BOM, Work Orders, Production Processes, Sub Contracts.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.production.schemas import (
    BOMCreate, BOMUpdate, BOMResponse, BOMListResponse,
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse, WorkOrderListResponse,
    ProductionProcessCreate, ProductionProcessUpdate,
    ProductionProcessResponse, ProductionProcessListResponse,
    IssueItemsRequest, CompleteProcessRequest,
    SubContractCreate, SubContractUpdate, SubContractResponse, SubContractListResponse,
)
from app.modules.production.services import (
    BOMService, WorkOrderService, ProductionProcessService, SubContractService,
)

router = APIRouter(prefix="/production", tags=["Production"])


# ─── BOM ─────────────────────────────────────────────────────────────────────

@router.get("/boms/next-id")
async def next_bom_id(db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    next_id = await BOMService._next_bom_id(db)
    return {"bom_id": next_id}

@router.post("/boms", response_model=BOMResponse)
async def create_bom(data: BOMCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await BOMService.create(db, data, user.full_name)

@router.get("/boms", response_model=BOMListResponse)
async def list_boms(
    skip: int = 0, limit: int = 100, status: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION)),
):
    boms, total = await BOMService.list(db, skip, limit, status)
    return {"boms": boms, "total": total}

@router.get("/boms/{bom_pk}", response_model=BOMResponse)
async def get_bom(bom_pk: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await BOMService.get(db, bom_pk)

@router.put("/boms/{bom_pk}", response_model=BOMResponse)
async def update_bom(bom_pk: int, data: BOMUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await BOMService.update(db, bom_pk, data, user.full_name)

@router.delete("/boms/{bom_pk}", status_code=204)
async def delete_bom(bom_pk: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    await BOMService.delete(db, bom_pk)


# ─── Work Orders ─────────────────────────────────────────────────────────────

@router.post("/work-orders", response_model=WorkOrderResponse)
async def create_wo(data: WorkOrderCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await WorkOrderService.create(db, data, user.full_name)

@router.get("/work-orders", response_model=WorkOrderListResponse)
async def list_wos(
    skip: int = 0, limit: int = 100, stage: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION)),
):
    orders, total = await WorkOrderService.list(db, skip, limit, stage)
    return {"orders": orders, "total": total}

@router.get("/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def get_wo(wo_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await WorkOrderService.get(db, wo_id)

@router.put("/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def update_wo(wo_id: int, data: WorkOrderUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await WorkOrderService.update(db, wo_id, data, user.full_name)

@router.delete("/work-orders/{wo_id}", status_code=204)
async def delete_wo(wo_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    await WorkOrderService.delete(db, wo_id)

@router.post("/work-orders/{wo_id}/start", response_model=ProductionProcessResponse)
async def start_wo_process(wo_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await WorkOrderService.start_process(db, wo_id, user.full_name)


# ─── Production Processes ────────────────────────────────────────────────────

@router.post("/processes", response_model=ProductionProcessResponse)
async def create_process(data: ProductionProcessCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.create(db, data, user.full_name)

@router.get("/processes", response_model=ProductionProcessListResponse)
async def list_processes(
    skip: int = 0, limit: int = 100,
    stage: str | None = None, status: str | None = None, process_type: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION)),
):
    processes, total = await ProductionProcessService.list(db, skip, limit, stage, status, process_type)
    return {"processes": processes, "total": total}

@router.get("/processes/{pp_id}", response_model=ProductionProcessResponse)
async def get_process(pp_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.get(db, pp_id)

@router.put("/processes/{pp_id}", response_model=ProductionProcessResponse)
async def update_process(pp_id: int, data: ProductionProcessUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.update(db, pp_id, data, user.full_name)

@router.post("/processes/issue-items", response_model=ProductionProcessResponse)
async def issue_items(data: IssueItemsRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.issue_items(db, data, user.full_name)

@router.post("/processes/{pp_id}/issue-from-bom", response_model=ProductionProcessResponse)
async def issue_from_bom(pp_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.issue_items_from_bom(db, pp_id, user.full_name)

@router.post("/processes/{pp_id}/complete", response_model=ProductionProcessResponse)
async def complete_process(pp_id: int, data: CompleteProcessRequest = CompleteProcessRequest(), db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await ProductionProcessService.complete(db, pp_id, data.completed_quantity, user.full_name)


# ─── Sub Contracts ───────────────────────────────────────────────────────────

@router.post("/sub-contracts", response_model=SubContractResponse)
async def create_sc(data: SubContractCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await SubContractService.create(db, data, user.full_name)

@router.get("/sub-contracts", response_model=SubContractListResponse)
async def list_scs(
    skip: int = 0, limit: int = 100, stage: str | None = None, status: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION)),
):
    scs, total = await SubContractService.list(db, skip, limit, stage, status)
    return {"sub_contracts": scs, "total": total}

@router.get("/sub-contracts/{sc_id}", response_model=SubContractResponse)
async def get_sc(sc_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await SubContractService.get(db, sc_id)

@router.put("/sub-contracts/{sc_id}", response_model=SubContractResponse)
async def update_sc(sc_id: int, data: SubContractUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    return await SubContractService.update(db, sc_id, data, user.full_name)

@router.delete("/sub-contracts/{sc_id}", status_code=204)
async def delete_sc(sc_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_module(Module.PRODUCTION))):
    await SubContractService.delete(db, sc_id)
