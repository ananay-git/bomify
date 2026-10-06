"""initial schema with module-based access

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # ── user_module_access ────────────────────────────────────────────────────
    # Create enum idempotently — handles re-runs after partial failures
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE module AS ENUM (
                'dashboard', 'sales', 'purchases', 'production', 'inventory',
                'dispatch', 'parties', 'copilot', 'users', 'settings'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.create_table(
        'user_module_access',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('module', postgresql.ENUM(name='module', create_type=False), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'module'),
    )

    # ── parties ───────────────────────────────────────────────────────────────
    op.create_table(
        'parties',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('party_type', sa.Enum('CUSTOMER', 'SUPPLIER', 'BOTH', 'BUYER', name='partytype'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contact_person', sa.String(100), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('payment_terms', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('reference_code', sa.String(50), nullable=True),
        sa.Column('gst_type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_parties_party_type', 'parties', ['party_type'])
    op.create_index('ix_parties_name', 'parties', ['name'])

    # ── locations ─────────────────────────────────────────────────────────────
    op.create_table(
        'locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('party_id', sa.Integer(), nullable=False),
        sa.Column('location_type', sa.Enum('BILLING', 'SHIPPING', 'DELIVERY', name='locationtype'), nullable=False),
        sa.Column('address_line1', sa.String(255), nullable=False),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(20), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_locations_party_id', 'locations', ['party_id'])
    op.create_index('ix_locations_location_type', 'locations', ['location_type'])

    # ── party_contacts ────────────────────────────────────────────────────────
    op.create_table(
        'party_contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('party_id', sa.Integer(), nullable=False),
        sa.Column('contact_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('role', sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── party_tags ────────────────────────────────────────────────────────────
    op.create_table(
        'party_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('party_id', sa.Integer(), nullable=False),
        sa.Column('tag', sa.String(50), nullable=False),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── inventory_items ───────────────────────────────────────────────────────
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category', sa.Enum('RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING', name='itemcategory'), nullable=True),
        sa.Column('product_service', sa.Enum('PRODUCT', 'SERVICE', name='productservicetype'), nullable=False),
        sa.Column('buy_sell', sa.Enum('BUY', 'SELL', 'BOTH', name='buyselltype'), nullable=False),
        sa.Column('unit_of_measure', sa.String(50), nullable=False),
        sa.Column('current_stock', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('default_price', sa.Numeric(12, 2), nullable=True, server_default='0.0'),
        sa.Column('hsn_code', sa.String(20), nullable=True),
        sa.Column('tax', sa.Numeric(5, 2), nullable=True, server_default='0.0'),
        sa.Column('min_stock_level', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('max_stock_level', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('reorder_level', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('regular_buying_price', sa.Numeric(12, 2), nullable=True, server_default='0.0'),
        sa.Column('wholesale_buying_price', sa.Numeric(12, 2), nullable=True, server_default='0.0'),
        sa.Column('regular_selling_price', sa.Numeric(12, 2), nullable=True, server_default='0.0'),
        sa.Column('wholesale_selling_price', sa.Numeric(12, 2), nullable=True, server_default='0.0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_items_sku', 'inventory_items', ['sku'], unique=True)
    op.create_index('ix_inventory_items_name', 'inventory_items', ['name'])
    op.create_index('ix_inventory_items_category', 'inventory_items', ['category'])

    # ── stock_transactions ────────────────────────────────────────────────────
    op.create_table(
        'stock_transactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.Enum('IN', 'OUT', 'ADJUSTMENT', name='transactiontype'), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('reference_id', sa.String(100), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_stock_transactions_item_id', 'stock_transactions', ['item_id'])

    # ── sales_orders ──────────────────────────────────────────────────────────
    op.create_table(
        'sales_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_number', sa.String(100), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum(
            'DRAFT', 'QUOTATION_SENT', 'CONFIRMED', 'PROCESSING',
            'SHIPPED', 'INVOICED', 'PAID', 'CANCELLED', name='salesorderstatus'
        ), nullable=True),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_terms', sa.String(50), nullable=True),
        sa.Column('billing_address', sa.JSON(), nullable=True),
        sa.Column('shipping_address', sa.JSON(), nullable=True),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('extra_charges', sa.JSON(), nullable=True),
        sa.Column('terms_conditions', sa.Text(), nullable=True),
        sa.Column('comments', sa.JSON(), nullable=True),
        sa.Column('additional_details', sa.JSON(), nullable=True),
        sa.Column('signature_data', sa.JSON(), nullable=True),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['parties.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sales_orders_order_number', 'sales_orders', ['order_number'], unique=True)
    op.create_index('ix_sales_orders_customer_id', 'sales_orders', ['customer_id'])
    op.create_index('ix_sales_orders_status', 'sales_orders', ['status'])

    # ── sales_order_items ─────────────────────────────────────────────────────
    op.create_table(
        'sales_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sales_order_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total_price', sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sales_order_items_sales_order_id', 'sales_order_items', ['sales_order_id'])

    # ── purchase_orders ───────────────────────────────────────────────────────
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('po_number', sa.String(100), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('document_type', sa.Enum(
            'PURCHASE_ORDER', 'SERVICE_ORDER', 'ORDER_CONFIRMATION',
            'SERVICE_CONFIRMATION', 'INVOICE', 'ADHOC_INVOICE',
            name='documenttype'
        ), nullable=True),
        sa.Column('linked_sales_order_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELLED', name='postatus'), nullable=True),
        sa.Column('payment_status', sa.Enum('PENDING', 'PARTIAL', 'PAID', name='paymentstatus'), nullable=True),
        sa.Column('invoice_status', sa.Enum('PENDING', 'COMPLETE', name='invoicestatus'), nullable=True),
        sa.Column('goods_status', sa.Enum('NOT_RECEIVED', 'RECEIVED', name='goodsstatus'), nullable=True),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('billing_location_id', sa.Integer(), nullable=True),
        sa.Column('delivery_location_id', sa.Integer(), nullable=True),
        sa.Column('expected_delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('extra_charges', sa.JSON(), nullable=True),
        sa.Column('terms_conditions', sa.Text(), nullable=True),
        sa.Column('comments', sa.JSON(), nullable=True),
        sa.Column('additional_details', sa.JSON(), nullable=True),
        sa.Column('signature_data', sa.JSON(), nullable=True),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['parties.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['linked_sales_order_id'], ['sales_orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['billing_location_id'], ['locations.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['delivery_location_id'], ['locations.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_purchase_orders_po_number', 'purchase_orders', ['po_number'], unique=True)
    op.create_index('ix_purchase_orders_supplier_id', 'purchase_orders', ['supplier_id'])
    op.create_index('ix_purchase_orders_status', 'purchase_orders', ['status'])
    op.create_index('ix_purchase_orders_document_type', 'purchase_orders', ['document_type'])

    # ── purchase_order_items ──────────────────────────────────────────────────
    op.create_table(
        'purchase_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('ordered_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('received_quantity', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_purchase_order_items_po_id', 'purchase_order_items', ['po_id'])

    # ── goods_receipt_notes ───────────────────────────────────────────────────
    op.create_table(
        'goods_receipt_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=False),
        sa.Column('grn_number', sa.String(100), nullable=False),
        sa.Column('receipt_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_goods_receipt_notes_grn_number', 'goods_receipt_notes', ['grn_number'], unique=True)
    op.create_index('ix_goods_receipt_notes_po_id', 'goods_receipt_notes', ['po_id'])

    # ── grn_items ─────────────────────────────────────────────────────────────
    op.create_table(
        'grn_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('grn_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('received_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('accepted_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('rejected_quantity', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.ForeignKeyConstraint(['grn_id'], ['goods_receipt_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_grn_items_grn_id', 'grn_items', ['grn_id'])

    # ── boms ──────────────────────────────────────────────────────────────────
    op.create_table(
        'boms',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bom_id', sa.String(20), nullable=False),
        sa.Column('bom_name', sa.String(200), nullable=False),
        sa.Column('fg_item_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default='DRAFT'),
        sa.Column('last_modified_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['fg_item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_boms_bom_id', 'boms', ['bom_id'], unique=True)
    op.create_index('ix_boms_fg_item_id', 'boms', ['fg_item_id'])
    op.create_index('ix_boms_status', 'boms', ['status'])

    # ── bom_items ─────────────────────────────────────────────────────────────
    op.create_table(
        'bom_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bom_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(['bom_id'], ['boms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bom_items_bom_id', 'bom_items', ['bom_id'])

    # ── work_orders ───────────────────────────────────────────────────────────
    op.create_table(
        'work_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('buyer_id', sa.Integer(), nullable=True),
        sa.Column('document_number', sa.String(100), nullable=True),
        sa.Column('order_type', sa.String(50), nullable=True),
        sa.Column('process_number', sa.String(100), nullable=True),
        sa.Column('process_stage', sa.String(50), nullable=True, server_default='OPEN'),
        sa.Column('delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('document_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['buyer_id'], ['parties.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_work_orders_item_id', 'work_orders', ['item_id'])
    op.create_index('ix_work_orders_buyer_id', 'work_orders', ['buyer_id'])
    op.create_index('ix_work_orders_document_number', 'work_orders', ['document_number'])
    op.create_index('ix_work_orders_process_stage', 'work_orders', ['process_stage'])

    # ── production_processes ──────────────────────────────────────────────────
    op.create_table(
        'production_processes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('process_number', sa.String(100), nullable=False),
        sa.Column('stage', sa.String(50), nullable=True, server_default='OPEN'),
        sa.Column('status', sa.String(50), nullable=True, server_default='NOT_STARTED'),
        sa.Column('bom_id', sa.Integer(), nullable=True),
        sa.Column('work_order_id', sa.Integer(), nullable=True),
        sa.Column('fg_item_id', sa.Integer(), nullable=False),
        sa.Column('process_type', sa.String(50), nullable=True, server_default='MASTER'),
        sa.Column('target_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('completed_quantity', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('order_delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_completion_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_modified_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['bom_id'], ['boms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['fg_item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_production_processes_process_number', 'production_processes', ['process_number'], unique=True)
    op.create_index('ix_production_processes_reference_number', 'production_processes', ['reference_number'])
    op.create_index('ix_production_processes_stage', 'production_processes', ['stage'])
    op.create_index('ix_production_processes_status', 'production_processes', ['status'])
    op.create_index('ix_production_processes_bom_id', 'production_processes', ['bom_id'])
    op.create_index('ix_production_processes_work_order_id', 'production_processes', ['work_order_id'])
    op.create_index('ix_production_processes_fg_item_id', 'production_processes', ['fg_item_id'])

    # ── issued_items ──────────────────────────────────────────────────────────
    op.create_table(
        'issued_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('production_process_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('required_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('issued_quantity', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['production_process_id'], ['production_processes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_issued_items_production_process_id', 'issued_items', ['production_process_id'])

    # ── sub_contracts ─────────────────────────────────────────────────────────
    op.create_table(
        'sub_contracts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('process_number', sa.String(100), nullable=False),
        sa.Column('job_work_number', sa.String(100), nullable=True),
        sa.Column('stage', sa.String(50), nullable=True, server_default='OPEN'),
        sa.Column('status', sa.String(50), nullable=True, server_default='NOT_STARTED'),
        sa.Column('fg_item_id', sa.Integer(), nullable=False),
        sa.Column('target_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('completed_quantity', sa.Numeric(10, 2), nullable=True, server_default='0.0'),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['fg_item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sub_contracts_process_number', 'sub_contracts', ['process_number'], unique=True)
    op.create_index('ix_sub_contracts_job_work_number', 'sub_contracts', ['job_work_number'])
    op.create_index('ix_sub_contracts_stage', 'sub_contracts', ['stage'])
    op.create_index('ix_sub_contracts_status', 'sub_contracts', ['status'])
    op.create_index('ix_sub_contracts_fg_item_id', 'sub_contracts', ['fg_item_id'])

    # ── dispatches ────────────────────────────────────────────────────────────
    op.create_table(
        'dispatches',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dispatch_number', sa.String(100), nullable=True),
        sa.Column('sales_order_id', sa.Integer(), nullable=True),
        sa.Column('production_process_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True, server_default='DRAFT'),
        sa.Column('logistics_partner', sa.String(100), nullable=True),
        sa.Column('tracking_number', sa.String(100), nullable=True),
        sa.Column('dispatch_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('vehicle_details', sa.String(200), nullable=True),
        sa.Column('driver_name', sa.String(100), nullable=True),
        sa.Column('driver_phone', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id']),
        sa.ForeignKeyConstraint(['production_process_id'], ['production_processes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dispatches_dispatch_number', 'dispatches', ['dispatch_number'], unique=True)
    op.create_index('ix_dispatches_status', 'dispatches', ['status'])
    op.create_index('ix_dispatches_production_process_id', 'dispatches', ['production_process_id'])

    # ── dispatch_items ────────────────────────────────────────────────────────
    op.create_table(
        'dispatch_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dispatch_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('picked_quantity', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('packed_quantity', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['dispatch_id'], ['dispatches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dispatch_items_dispatch_id', 'dispatch_items', ['dispatch_id'])

    # ── copilot_threads ───────────────────────────────────────────────────────
    op.create_table(
        'copilot_threads',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('thread_id', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_copilot_threads_thread_id', 'copilot_threads', ['thread_id'], unique=True)
    op.create_index('ix_copilot_threads_user_id', 'copilot_threads', ['user_id'])

    # ── copilot_charts ────────────────────────────────────────────────────────
    op.create_table(
        'copilot_charts',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('plotly_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_copilot_charts_id', 'copilot_charts', ['id'])

    # ── settings ──────────────────────────────────────────────────────────────
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('key', sa.String(200), nullable=False),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category', 'key', name='uq_settings_category_key'),
    )
    op.create_index('ix_settings_category', 'settings', ['category'])
    op.create_index('ix_settings_key', 'settings', ['key'])


def downgrade() -> None:
    op.drop_table('settings')
    op.drop_table('copilot_charts')
    op.drop_table('copilot_threads')
    op.drop_table('dispatch_items')
    op.drop_table('dispatches')
    op.drop_table('sub_contracts')
    op.drop_table('issued_items')
    op.drop_table('production_processes')
    op.drop_table('work_orders')
    op.drop_table('bom_items')
    op.drop_table('boms')
    op.drop_table('grn_items')
    op.drop_table('goods_receipt_notes')
    op.drop_table('purchase_order_items')
    op.drop_table('purchase_orders')
    op.drop_table('sales_order_items')
    op.drop_table('sales_orders')
    op.drop_table('stock_transactions')
    op.drop_table('inventory_items')
    op.drop_table('party_tags')
    op.drop_table('party_contacts')
    op.drop_table('locations')
    op.drop_table('parties')
    op.drop_table('user_module_access')
    op.drop_table('users')

    # Drop enums
    for enum_name in [
        'module', 'partytype', 'locationtype', 'itemcategory',
        'productservicetype', 'buyselltype', 'transactiontype',
        'salesorderstatus', 'documenttype', 'postatus',
        'paymentstatus', 'invoicestatus', 'goodsstatus',
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
