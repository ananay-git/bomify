"""
Production Services.
BOM, Work Orders, Production Processes, Sub Contracts, and Issue Items.
"""
from typing import Sequence
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.production.models import (
    BOM, BOMItem, WorkOrder, ProductionProcess, IssuedItem, SubContract,
    ProcessStage, ProcessStatus, WorkOrderStage, BOMStatus,
)
from app.modules.production.schemas import (
    BOMCreate, BOMUpdate,
    WorkOrderCreate, WorkOrderUpdate,
    ProductionProcessCreate, ProductionProcessUpdate,
    SubContractCreate, SubContractUpdate,
    IssueItemsRequest,
)
from app.modules.inventory.models import Item, StockTransaction, TransactionType
from app.modules.parties.models import Party
from app.core.exceptions import NotFoundError, ConflictError


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _enrich_bom(db: AsyncSession, bom: BOM) -> dict:
    """Add FG name/UoM and item details to a BOM response."""
    fg = await db.get(Item, bom.fg_item_id)
    items_out = []
    for bi in bom.items:
        item = await db.get(Item, bi.item_id)
        items_out.append({
            "id": bi.id, "item_id": bi.item_id, "quantity": float(bi.quantity),
            "item_name": item.name if item else None,
            "item_sku": item.sku if item else None,
            "unit_of_measure": item.unit_of_measure if item else None,
        })
    return {
        "id": bom.id, "bom_id": bom.bom_id, "bom_name": bom.bom_name,
        "fg_item_id": bom.fg_item_id,
        "fg_name": fg.name if fg else None,
        "fg_uom": fg.unit_of_measure if fg else None,
        "status": bom.status, "num_rm": len(bom.items),
        "last_modified_by": bom.last_modified_by,
        "created_at": bom.created_at, "updated_at": bom.updated_at,
        "items": items_out,
    }


async def _enrich_wo(db: AsyncSession, wo: WorkOrder) -> dict:
    """Add item name/UoM and buyer name to a WO response."""
    item = await db.get(Item, wo.item_id)
    buyer = await db.get(Party, wo.buyer_id) if wo.buyer_id else None
    return {
        "id": wo.id, "item_id": wo.item_id,
        "item_name": item.name if item else None,
        "item_sku": item.sku if item else None,
        "uom": item.unit_of_measure if item else None,
        "quantity": float(wo.quantity),
        "buyer_id": wo.buyer_id,
        "buyer_name": buyer.name if buyer else None,
        "document_number": wo.document_number,
        "order_type": wo.order_type,
        "process_number": wo.process_number,
        "process_stage": wo.process_stage,
        "delivery_date": wo.delivery_date,
        "document_date": wo.document_date,
        "created_by": wo.created_by,
        "created_at": wo.created_at, "updated_at": wo.updated_at,
    }


async def _enrich_process(db: AsyncSession, pp: ProductionProcess) -> dict:
    """Add FG and BOM details to a production process response."""
    fg = await db.get(Item, pp.fg_item_id)
    bom = None
    if pp.bom_id:
        bom = await db.get(BOM, pp.bom_id)
    issued = []
    for ii in pp.issued_items:
        item = await db.get(Item, ii.item_id)
        issued.append({
            "id": ii.id, "item_id": ii.item_id,
            "item_name": item.name if item else None,
            "item_sku": item.sku if item else None,
            "required_quantity": float(ii.required_quantity),
            "issued_quantity": float(ii.issued_quantity),
            "created_at": ii.created_at,
        })
    
    dispatch_ready = pp.stage == ProcessStage.COMPLETED
    linked_sales_order_id = None
    linked_dispatch_status = None
    
    # Query sales order if linked via work order
    if pp.work_order_id:
        wo = await db.get(WorkOrder, pp.work_order_id)
        if wo and wo.document_number:
            from app.modules.sales.models import SalesOrder
            result = await db.execute(select(SalesOrder.id).where(SalesOrder.order_number == wo.document_number))
            linked_sales_order_id = result.scalar_one_or_none()

    # Query dispatch status — check both production_process_id and sales_order_id links
    # NOTE: We avoid filtering by enum in SQL due to DB native enum case mismatch.
    # Instead, we fetch all dispatches and filter in Python.
    from app.modules.dispatch.models import Dispatch, DispatchStatus
    dispatch_result = await db.execute(
        select(Dispatch.status).where(Dispatch.production_process_id == pp.id)
        .order_by(Dispatch.id.desc())
    )
    dispatch_statuses = dispatch_result.scalars().all()

    # Find the latest non-cancelled dispatch status
    for ds in dispatch_statuses:
        ds_val = ds.value if hasattr(ds, 'value') else str(ds)
        if ds_val.lower() != 'cancelled':
            linked_dispatch_status = ds_val.lower()
            break

    # Fallback: check via linked sales order
    if not linked_dispatch_status and linked_sales_order_id:
        so_dispatch_result = await db.execute(
            select(Dispatch.status).where(Dispatch.sales_order_id == linked_sales_order_id)
            .order_by(Dispatch.id.desc())
        )
        so_dispatch_statuses = so_dispatch_result.scalars().all()
        for ds in so_dispatch_statuses:
            ds_val = ds.value if hasattr(ds, 'value') else str(ds)
            if ds_val.lower() != 'cancelled':
                linked_dispatch_status = ds_val.lower()
                break

    return {
        "id": pp.id, "reference_number": pp.reference_number,
        "process_number": pp.process_number,
        "stage": pp.stage, "status": pp.status,
        "bom_id": pp.bom_id,
        "bom_number": bom.bom_id if bom else None,
        "work_order_id": pp.work_order_id,
        "fg_item_id": pp.fg_item_id,
        "fg_name": fg.name if fg else None,
        "fg_uom": fg.unit_of_measure if fg else None,
        "process_type": pp.process_type,
        "target_quantity": float(pp.target_quantity),
        "completed_quantity": float(pp.completed_quantity),
        "order_delivery_date": pp.order_delivery_date,
        "expected_completion_date": pp.expected_completion_date,
        "last_modified_by": pp.last_modified_by,
        "created_at": pp.created_at, "updated_at": pp.updated_at,
        "issued_items": issued,
        "dispatch_ready": dispatch_ready,
        "linked_sales_order_id": linked_sales_order_id,
        "linked_dispatch_status": linked_dispatch_status,
    }


async def _enrich_sc(db: AsyncSession, sc: SubContract) -> dict:
    fg = await db.get(Item, sc.fg_item_id)
    return {
        "id": sc.id, "process_number": sc.process_number,
        "job_work_number": sc.job_work_number,
        "stage": sc.stage, "status": sc.status,
        "fg_item_id": sc.fg_item_id,
        "fg_name": fg.name if fg else None,
        "fg_uom": fg.unit_of_measure if fg else None,
        "target_quantity": float(sc.target_quantity),
        "completed_quantity": float(sc.completed_quantity),
        "created_by": sc.created_by,
        "created_at": sc.created_at, "updated_at": sc.updated_at,
    }


# ─── BOM Service ─────────────────────────────────────────────────────────────

class BOMService:
    @staticmethod
    async def _next_bom_id(db: AsyncSession) -> str:
        result = await db.execute(select(func.coalesce(func.max(BOM.id), 0)))
        max_id = result.scalar_one()
        return f"BOM{str(max_id).zfill(5)}"

    @staticmethod
    async def create(db: AsyncSession, data: BOMCreate, username: str | None = None) -> dict:
        bom_id = await BOMService._next_bom_id(db)
        bom = BOM(
            bom_id=bom_id, bom_name=data.bom_name,
            fg_item_id=data.fg_item_id, status=data.status,
            last_modified_by=username,
        )
        db.add(bom)
        await db.flush()
        for item_data in data.items:
            db.add(BOMItem(bom_id=bom.id, item_id=item_data.item_id, quantity=item_data.quantity))
        await db.flush()
        result = await db.execute(
            select(BOM).options(selectinload(BOM.items)).where(BOM.id == bom.id)
        )
        return await _enrich_bom(db, result.scalar_one())

    @staticmethod
    async def get(db: AsyncSession, bom_pk: int) -> dict:
        result = await db.execute(
            select(BOM).options(selectinload(BOM.items)).where(BOM.id == bom_pk)
        )
        bom = result.scalar_one_or_none()
        if not bom:
            raise NotFoundError("BOM not found")
        return await _enrich_bom(db, bom)

    @staticmethod
    async def list(db: AsyncSession, skip: int = 0, limit: int = 100, status: str | None = None) -> tuple[list[dict], int]:
        q = select(BOM).options(selectinload(BOM.items))
        cq = select(func.count(BOM.id))
        if status:
            q = q.where(BOM.status == status)
            cq = cq.where(BOM.status == status)
        result = await db.execute(q.offset(skip).limit(limit).order_by(BOM.id.desc()))
        boms = result.scalars().all()
        total = (await db.execute(cq)).scalar_one()
        return [await _enrich_bom(db, b) for b in boms], total

    @staticmethod
    async def update(db: AsyncSession, bom_pk: int, data: BOMUpdate, username: str | None = None) -> dict:
        result = await db.execute(
            select(BOM).options(selectinload(BOM.items)).where(BOM.id == bom_pk)
        )
        bom = result.scalar_one_or_none()
        if not bom:
            raise NotFoundError("BOM not found")
        if data.bom_name is not None:
            bom.bom_name = data.bom_name
        if data.fg_item_id is not None:
            bom.fg_item_id = data.fg_item_id
        if data.status is not None:
            bom.status = data.status
        bom.last_modified_by = username
        if data.items is not None:
            # Replace all items
            for existing in bom.items:
                await db.delete(existing)
            await db.flush()
            for item_data in data.items:
                db.add(BOMItem(bom_id=bom.id, item_id=item_data.item_id, quantity=item_data.quantity))
            await db.flush()
        result = await db.execute(
            select(BOM).options(selectinload(BOM.items)).where(BOM.id == bom.id)
        )
        return await _enrich_bom(db, result.scalar_one())

    @staticmethod
    async def delete(db: AsyncSession, bom_pk: int) -> None:
        result = await db.execute(select(BOM).where(BOM.id == bom_pk))
        bom = result.scalar_one_or_none()
        if not bom:
            raise NotFoundError("BOM not found")
        await db.delete(bom)


# ─── Work Order Service ──────────────────────────────────────────────────────

class WorkOrderService:
    @staticmethod
    async def create(db: AsyncSession, data: WorkOrderCreate, username: str | None = None) -> dict:
        wo = WorkOrder(
            item_id=data.item_id, quantity=data.quantity,
            buyer_id=data.buyer_id, document_number=data.document_number,
            order_type=data.order_type,
            delivery_date=data.delivery_date, document_date=data.document_date,
            created_by=username,
        )
        db.add(wo)
        await db.flush()
        return await _enrich_wo(db, wo)

    @staticmethod
    async def get(db: AsyncSession, wo_id: int) -> dict:
        wo = await db.get(WorkOrder, wo_id)
        if not wo:
            raise NotFoundError("Work order not found")
        return await _enrich_wo(db, wo)

    @staticmethod
    async def list(db: AsyncSession, skip: int = 0, limit: int = 100, stage: str | None = None) -> tuple[list[dict], int]:
        q = select(WorkOrder)
        cq = select(func.count(WorkOrder.id))
        if stage:
            q = q.where(WorkOrder.process_stage == stage)
            cq = cq.where(WorkOrder.process_stage == stage)
        result = await db.execute(q.offset(skip).limit(limit).order_by(WorkOrder.id.desc()))
        wos = result.scalars().all()
        total = (await db.execute(cq)).scalar_one()
        return [await _enrich_wo(db, wo) for wo in wos], total

    @staticmethod
    async def update(db: AsyncSession, wo_id: int, data: WorkOrderUpdate, username: str | None = None) -> dict:
        wo = await db.get(WorkOrder, wo_id)
        if not wo:
            raise NotFoundError("Work order not found")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(wo, key, value)
        return await _enrich_wo(db, wo)

    @staticmethod
    async def delete(db: AsyncSession, wo_id: int) -> None:
        wo = await db.get(WorkOrder, wo_id)
        if not wo:
            raise NotFoundError("Work order not found")
        await db.delete(wo)

    @staticmethod
    async def start_process(db: AsyncSession, wo_id: int, username: str | None = None) -> dict:
        """Create a ProductionProcess from a Work Order and mark it in_progress."""
        wo = await db.get(WorkOrder, wo_id)
        if not wo:
            raise NotFoundError("Work order not found")
        if wo.process_stage != WorkOrderStage.OPEN:
            raise ConflictError("Work order is not in OPEN stage")

        # Auto-link the most recent published BOM that has at least one component
        from sqlalchemy import exists as sa_exists
        bom_result = await db.execute(
            select(BOM)
            .where(
                BOM.fg_item_id == wo.item_id,
                BOM.status == BOMStatus.PUBLISHED,
                sa_exists().where(BOMItem.bom_id == BOM.id),
            )
            .order_by(BOM.id.desc())
            .limit(1)
        )
        linked_bom = bom_result.scalar_one_or_none()

        process_number = await ProductionProcessService._next_process_number(db)
        pp = ProductionProcess(
            process_number=process_number,
            work_order_id=wo.id,
            fg_item_id=wo.item_id,
            bom_id=linked_bom.id if linked_bom else None,
            target_quantity=float(wo.quantity),
            order_delivery_date=wo.delivery_date,
        )
        db.add(pp)
        wo.process_stage = WorkOrderStage.IN_PROGRESS
        wo.process_number = process_number
        await db.flush()

        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp.id)
        )
        return await _enrich_process(db, result.scalar_one())


# ─── Production Process Service ──────────────────────────────────────────────

class ProductionProcessService:
    @staticmethod
    async def _next_process_number(db: AsyncSession) -> str:
        result = await db.execute(select(func.coalesce(func.max(ProductionProcess.id), 0)))
        max_id = result.scalar_one()
        return f"PP{str(max_id + 1).zfill(5)}"

    @staticmethod
    async def create(db: AsyncSession, data: ProductionProcessCreate, username: str | None = None) -> dict:
        process_number = await ProductionProcessService._next_process_number(db)
        pp = ProductionProcess(
            process_number=process_number,
            work_order_id=data.work_order_id,
            bom_id=data.bom_id,
            fg_item_id=data.fg_item_id,
            target_quantity=data.target_quantity,
            process_type=data.process_type,
            order_delivery_date=data.order_delivery_date,
            expected_completion_date=data.expected_completion_date,
            last_modified_by=username,
        )
        db.add(pp)
        await db.flush()
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp.id)
        )
        return await _enrich_process(db, result.scalar_one())

    @staticmethod
    async def get(db: AsyncSession, pp_id: int) -> dict:
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp_id)
        )
        pp = result.scalar_one_or_none()
        if not pp:
            raise NotFoundError("Production process not found")
        return await _enrich_process(db, pp)

    @staticmethod
    async def list(
        db: AsyncSession, skip: int = 0, limit: int = 100,
        stage: str | None = None, status: str | None = None, process_type: str | None = None,
    ) -> tuple[list[dict], int]:
        q = select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
        cq = select(func.count(ProductionProcess.id))
        if stage:
            q = q.where(ProductionProcess.stage == stage)
            cq = cq.where(ProductionProcess.stage == stage)
        if status:
            q = q.where(ProductionProcess.status == status)
            cq = cq.where(ProductionProcess.status == status)
        if process_type:
            q = q.where(ProductionProcess.process_type == process_type)
            cq = cq.where(ProductionProcess.process_type == process_type)
        result = await db.execute(q.offset(skip).limit(limit).order_by(ProductionProcess.id.desc()))
        pps = result.scalars().all()
        total = (await db.execute(cq)).scalar_one()
        return [await _enrich_process(db, pp) for pp in pps], total

    @staticmethod
    async def update(db: AsyncSession, pp_id: int, data: ProductionProcessUpdate, username: str | None = None) -> dict:
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp_id)
        )
        pp = result.scalar_one_or_none()
        if not pp:
            raise NotFoundError("Production process not found")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(pp, key, value)
        pp.last_modified_by = username

        # Auto-complete if target reached
        if pp.completed_quantity >= pp.target_quantity and pp.stage != ProcessStage.COMPLETED:
            pp.stage = ProcessStage.COMPLETED
            pp.status = ProcessStatus.COMPLETED
            # Add finished goods to inventory
            inv_result = await db.execute(
                select(Item).where(Item.id == pp.fg_item_id).with_for_update()
            )
            fg_item = inv_result.scalar_one_or_none()
            if fg_item:
                fg_item.current_stock = float(fg_item.current_stock) + float(pp.completed_quantity)
                db.add(StockTransaction(
                    item_id=fg_item.id, transaction_type=TransactionType.IN,
                    quantity=float(pp.completed_quantity),
                    reference_id=pp.process_number, reference_type="production_process",
                    notes=f"Production completed: {pp.process_number}",
                ))
        return await _enrich_process(db, pp)

    @staticmethod
    async def issue_items(db: AsyncSession, data: IssueItemsRequest, username: str | None = None) -> dict:
        """Issue raw materials from inventory for a production process."""
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == data.process_id)
        )
        pp = result.scalar_one_or_none()
        if not pp:
            raise NotFoundError("Production process not found")

        for issue in data.items:
            # Deduct from inventory with row-level locking
            inv_result = await db.execute(
                select(Item).where(Item.id == issue.item_id).with_for_update()
            )
            item = inv_result.scalar_one_or_none()
            if not item:
                raise NotFoundError(f"Item {issue.item_id} not found")
            new_stock = float(item.current_stock) - float(issue.issued_quantity)
            if new_stock < 0:
                raise ConflictError(
                    f"Insufficient stock for {item.sku}. "
                    f"Available: {item.current_stock}, Requested: {issue.issued_quantity}"
                )
            item.current_stock = new_stock
            db.add(StockTransaction(
                item_id=item.id, transaction_type=TransactionType.OUT,
                quantity=float(issue.issued_quantity),
                reference_id=pp.process_number, reference_type="production_issue",
                notes=f"Issued for production: {pp.process_number}",
            ))
            db.add(IssuedItem(
                production_process_id=pp.id, item_id=issue.item_id,
                required_quantity=issue.required_quantity,
                issued_quantity=issue.issued_quantity,
            ))

        pp.stage = ProcessStage.MATERIAL_ISSUED
        pp.status = ProcessStatus.RUNNING
        pp.last_modified_by = username
        await db.flush()

        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp.id)
        )
        return await _enrich_process(db, result.scalar_one())

    @staticmethod
    async def complete(db: AsyncSession, pp_id: int, completed_quantity: float | None = None, username: str | None = None) -> dict:
        """Mark a production process as complete.

        - If materials have not been issued yet and a BOM is linked, auto-issues them first.
        - Adds the finished good quantity to inventory.
        - Sets stage=completed and status=completed.
        """
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp_id)
        )
        pp = result.scalar_one_or_none()
        if not pp:
            raise NotFoundError("Production process not found")
        if pp.stage == ProcessStage.COMPLETED:
            raise ConflictError("Production process is already completed")
        if pp.stage == ProcessStage.CANCELLED:
            raise ConflictError("Cannot complete a cancelled production process")

        qty = completed_quantity if completed_quantity is not None else float(pp.target_quantity)

        # Auto-issue raw materials from BOM if not yet issued
        if pp.stage == ProcessStage.OPEN and pp.bom_id:
            bom_result = await db.execute(
                select(BOM).options(selectinload(BOM.items)).where(BOM.id == pp.bom_id)
            )
            bom = bom_result.scalar_one_or_none()
            if bom and not bom.items:
                raise ConflictError(
                    f"BOM {bom.bom_id} has no raw material components defined. "
                    "Please add components to the BOM before completing this process."
                )
            if bom:
                for bi in bom.items:
                    required = float(bi.quantity) * float(pp.target_quantity)
                    inv_result = await db.execute(
                        select(Item).where(Item.id == bi.item_id).with_for_update()
                    )
                    item = inv_result.scalar_one_or_none()
                    if not item:
                        raise NotFoundError(f"Raw material item {bi.item_id} not found")
                    new_stock = float(item.current_stock) - required
                    if new_stock < 0:
                        raise ConflictError(
                            f"Insufficient stock for {item.sku}. "
                            f"Available: {item.current_stock}, Required: {required}"
                        )
                    item.current_stock = new_stock
                    db.add(StockTransaction(
                        item_id=item.id, transaction_type=TransactionType.OUT,
                        quantity=required,
                        reference_id=pp.process_number, reference_type="production_issue",
                        notes=f"Auto-issued on completion: {pp.process_number}",
                    ))
                    db.add(IssuedItem(
                        production_process_id=pp.id, item_id=bi.item_id,
                        required_quantity=required, issued_quantity=required,
                    ))

        # Add finished goods to inventory
        fg_result = await db.execute(
            select(Item).where(Item.id == pp.fg_item_id).with_for_update()
        )
        fg_item = fg_result.scalar_one_or_none()
        if fg_item:
            fg_item.current_stock = float(fg_item.current_stock) + qty
            db.add(StockTransaction(
                item_id=fg_item.id, transaction_type=TransactionType.IN,
                quantity=qty,
                reference_id=pp.process_number, reference_type="production_process",
                notes=f"Production completed: {pp.process_number}",
            ))

        pp.completed_quantity = qty
        pp.stage = ProcessStage.COMPLETED
        pp.status = ProcessStatus.COMPLETED
        pp.last_modified_by = username

        # Mark linked work order as completed
        if pp.work_order_id:
            wo = await db.get(WorkOrder, pp.work_order_id)
            if wo:
                wo.process_stage = WorkOrderStage.COMPLETED

        await db.flush()
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == pp.id)
        )
        return await _enrich_process(db, result.scalar_one())

    @staticmethod
    async def issue_items_from_bom(db: AsyncSession, process_id: int, username: str | None = None) -> dict:
        """Auto-issue all materials from the linked BOM."""
        result = await db.execute(
            select(ProductionProcess).options(selectinload(ProductionProcess.issued_items))
            .where(ProductionProcess.id == process_id)
        )
        pp = result.scalar_one_or_none()
        if not pp:
            raise NotFoundError("Production process not found")
        if not pp.bom_id:
            raise ConflictError("No BOM linked to this production process")

        bom_result = await db.execute(
            select(BOM).options(selectinload(BOM.items)).where(BOM.id == pp.bom_id)
        )
        bom = bom_result.scalar_one_or_none()
        if not bom:
            raise NotFoundError("BOM not found")

        multiplier = float(pp.target_quantity)
        items_to_issue = []
        for bi in bom.items:
            qty = float(bi.quantity) * multiplier
            items_to_issue.append({"item_id": bi.item_id, "required_quantity": qty, "issued_quantity": qty})

        from app.modules.production.schemas import IssuedItemCreate
        request = IssueItemsRequest(
            process_id=process_id,
            items=[IssuedItemCreate(**i) for i in items_to_issue],
        )
        return await ProductionProcessService.issue_items(db, request, username)


# ─── Sub Contract Service ────────────────────────────────────────────────────

class SubContractService:
    @staticmethod
    async def _next_sc_number(db: AsyncSession) -> str:
        result = await db.execute(select(func.coalesce(func.max(SubContract.id), 0)))
        max_id = result.scalar_one()
        return f"SC{str(max_id + 1).zfill(5)}"

    @staticmethod
    async def create(db: AsyncSession, data: SubContractCreate, username: str | None = None) -> dict:
        process_number = await SubContractService._next_sc_number(db)
        sc = SubContract(
            process_number=process_number,
            job_work_number=data.job_work_number,
            fg_item_id=data.fg_item_id,
            target_quantity=data.target_quantity,
            created_by=username,
        )
        db.add(sc)
        await db.flush()
        return await _enrich_sc(db, sc)

    @staticmethod
    async def get(db: AsyncSession, sc_id: int) -> dict:
        sc = await db.get(SubContract, sc_id)
        if not sc:
            raise NotFoundError("Sub contract not found")
        return await _enrich_sc(db, sc)

    @staticmethod
    async def list(db: AsyncSession, skip: int = 0, limit: int = 100, stage: str | None = None, status: str | None = None) -> tuple[list[dict], int]:
        q = select(SubContract)
        cq = select(func.count(SubContract.id))
        if stage:
            q = q.where(SubContract.stage == stage)
            cq = cq.where(SubContract.stage == stage)
        if status:
            q = q.where(SubContract.status == status)
            cq = cq.where(SubContract.status == status)
        result = await db.execute(q.offset(skip).limit(limit).order_by(SubContract.id.desc()))
        scs = result.scalars().all()
        total = (await db.execute(cq)).scalar_one()
        return [await _enrich_sc(db, sc) for sc in scs], total

    @staticmethod
    async def update(db: AsyncSession, sc_id: int, data: SubContractUpdate, username: str | None = None) -> dict:
        sc = await db.get(SubContract, sc_id)
        if not sc:
            raise NotFoundError("Sub contract not found")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sc, key, value)
        return await _enrich_sc(db, sc)

    @staticmethod
    async def delete(db: AsyncSession, sc_id: int) -> None:
        sc = await db.get(SubContract, sc_id)
        if not sc:
            raise NotFoundError("Sub contract not found")
        await db.delete(sc)
