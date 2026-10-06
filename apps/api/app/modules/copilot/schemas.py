"""
Copilot Schemas.
"""
from pydantic import BaseModel
from datetime import datetime


class CopilotQueryRequest(BaseModel):
    query: str
    thread_id: str | None = None


class CopilotQueryResponse(BaseModel):
    natural_language_summary: str
    generated_sql: str | None = None
    # chart_files: list of chart IDs; fetch each via GET /api/copilot/charts/{id}
    # The frontend loads the full Plotly JSON and renders it directly.
    chart_files: list[str] = []
    thread_id: str


class CopilotThreadResponse(BaseModel):
    id: int
    thread_id: str
    title: str
    created_at: datetime


class CopilotMessageDto(BaseModel):
    role: str
    content: str
    chart_ids: list[str] = []
    sql_query: str | None = None
