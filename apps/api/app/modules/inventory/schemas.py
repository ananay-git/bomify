"""
Inventory Pydantic schemas.
"""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Sequence
from app.modules.inventory.models import ItemCategory, TransactionType, ProductServiceType, BuySellType

class ItemCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    category: ItemCategory | None = None
    product_service: ProductServiceType = ProductServiceType.PRODUCT
    buy_sell: BuySellType = BuySellType.BUY
    unit_of_measure: str = Field(..., min_length=1, max_length=50)
    current_stock: float = 0.0
    default_price: float = 0.0
    hsn_code: str | None = None
    tax: float = 0.0
    min_stock_level: float = 0.0
    max_stock_level: float = 0.0
    reorder_level: float = 0.0
    regular_buying_price: float = 0.0
    wholesale_buying_price: float = 0.0
    regular_selling_price: float = 0.0
    wholesale_selling_price: float = 0.0
    description: str | None = None

class ItemUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    category: ItemCategory | None = None
    product_service: ProductServiceType | None = None
    buy_sell: BuySellType | None = None
    unit_of_measure: str | None = None
    default_price: float | None = None
    hsn_code: str | None = None
    tax: float | None = None
    min_stock_level: float | None = None
    max_stock_level: float | None = None
    reorder_level: float | None = None
    regular_buying_price: float | None = None
    wholesale_buying_price: float | None = None
    regular_selling_price: float | None = None
    wholesale_selling_price: float | None = None
    description: str | None = None

class ItemResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: ItemCategory | None
    product_service: ProductServiceType
    buy_sell: BuySellType
    unit_of_measure: str
    current_stock: float
    default_price: float
    hsn_code: str | None
    tax: float
    min_stock_level: float
    max_stock_level: float
    reorder_level: float
    regular_buying_price: float
    wholesale_buying_price: float
    regular_selling_price: float
    wholesale_selling_price: float
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class ItemListResponse(BaseModel):
    items: Sequence[ItemResponse]
    total: int

class StockTransactionCreate(BaseModel):
    item_id: int
    transaction_type: TransactionType
    quantity: float
    reference_id: str | None = None
    reference_type: str | None = None
    notes: str | None = None

class StockTransactionResponse(StockTransactionCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}

class StockTransactionListResponse(BaseModel):
    transactions: Sequence[StockTransactionResponse]
    total: int

# ── Dashboard schemas ──

class StockLevelSummary(BaseModel):
    negative_stock: int = 0
    low_stock: int = 0
    reorder_stock: int = 0
    optimum_stock: int = 0
    high_stock: int = 0
    excess_stock: int = 0
    total_items: int = 0

class TopItemEntry(BaseModel):
    item_id: int
    item_name: str
    invoices: int = 0
    traded_amount: float = 0.0

class StockValuationByCategory(BaseModel):
    category: str
    value: float
    count: int

class InventoryDashboardResponse(BaseModel):
    stock_valuation_value: float
    stock_valuation_count: int
    stock_levels: StockLevelSummary
    top_selling_items: list[TopItemEntry]
    top_purchased_items: list[TopItemEntry]
    valuation_by_category: list[StockValuationByCategory]
    last_updated: datetime
