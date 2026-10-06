import logging
logger=logging.getLogger(__name__)
"""
Copilot Router.
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.dependencies import require_module
from app.modules.users.models import Module, User
from app.modules.copilot.schemas import CopilotQueryRequest, CopilotQueryResponse, CopilotThreadResponse, CopilotMessageDto
from app.modules.copilot.services import CopilotService, get_agent
from app.modules.copilot.models import CopilotThread
from app.core.exceptions import ForbiddenError
from app.core.database import get_db

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


@router.post("/ask", response_model=CopilotQueryResponse)
async def ask_copilot(
    request: CopilotQueryRequest,
    current_user: User = Depends(require_module(Module.COPILOT)),
):
    print("HELLO WE HIT THE ASK ENDPOINT", flush=True)
    import logging
    logging.info("Ask copilot hit!")
    return await CopilotService.process_query(request, user_id=current_user.id)


@router.get("/threads", response_model=list[CopilotThreadResponse])
async def list_threads(
    current_user: User = Depends(require_module(Module.COPILOT)),
    db: AsyncSession = Depends(get_db)
):
    """Fetch all past conversation threads mapped to this user."""
    result = await db.execute(
        select(CopilotThread)
        .where(CopilotThread.user_id == current_user.id)
        .order_by(CopilotThread.created_at.desc())
    )
    return result.scalars().all()


@router.get("/threads/{thread_id}/history", response_model=list[CopilotMessageDto])
async def get_thread_history(
    thread_id: str,
    current_user: User = Depends(require_module(Module.COPILOT)),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch structured history from the LangGraph AsyncPostgresSaver checkpointer.

    Collapses the raw LangGraph message list (HumanMessage / AIMessage with
    tool_calls / ToolMessage / final AIMessage) into clean user + agent turns.

    Strategy:
      - HumanMessage  → user turn (1-to-1)
      - AIMessage     → skip if it only contains tool_calls and no visible text
                        (it is an intermediate "planning" step, not a reply)
      - ToolMessage   → mine for chart_ids; carry sql_query forward from the
                        AIMessage tool_call that triggered it
      - Final AIMessage with text → agent turn, decorated with all chart_ids
                        and the last sql_query collected in that reasoning chain
    """
    # Ensure thread belongs to user
    result = await db.execute(
        select(CopilotThread).where(
            CopilotThread.thread_id == thread_id,
            CopilotThread.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise ForbiddenError("Thread not found")

    agent = await get_agent()
    config = {"configurable": {"thread_id": thread_id}}
    state = await agent.aget_state(config)
    messages_raw = state.values.get("messages", [])

    # ------------------------------------------------------------------
    # Build a tool_call_id → sql_query index from all AIMessages so we can
    # correlate ToolMessages back to the SQL that was executed.
    # ------------------------------------------------------------------
    sql_by_tool_call_id: dict[str, str] = {}
    for msg in messages_raw:
        if msg.type != "ai":
            continue
        for tc in getattr(msg, "tool_calls", []):
            if tc.get("name") == "sql_db_query":
                call_id = tc.get("id") or tc.get("tool_call_id", "")
                query = tc.get("args", {}).get("query")
                if call_id and query:
                    sql_by_tool_call_id[call_id] = query

    # ------------------------------------------------------------------
    # Walk messages in order, accumulating tool artefacts between
    # AI turns and flushing them onto the final text-bearing AI turn.
    # ------------------------------------------------------------------
    chat_history: list[CopilotMessageDto] = []

    # Accumulators reset at the start of each agent reasoning chain
    pending_chart_ids: list[str] = []
    pending_sql: str | None = None

    for msg in messages_raw:

        # ── Human message → user turn, flush any stale pending state ──
        if msg.type == "human":
            pending_chart_ids = []
            pending_sql = None
            raw = getattr(msg, "content", "")
            content = (
                "\n".join(
                    c.get("text", "")
                    for c in raw
                    if isinstance(c, dict) and c.get("type") == "text"
                )
                if isinstance(raw, list)
                else str(raw)
            )
            chat_history.append(CopilotMessageDto(
                role="user",
                content=content,
                chart_ids=[],
                sql_query=None,
            ))
            continue

        # ── ToolMessage → harvest chart_ids and sql_query ──────────────
        if msg.type == "tool":
            raw = getattr(msg, "content", "")
            tool_content = str(raw) if not isinstance(raw, list) else "\n".join(
                c.get("text", "") for c in raw if isinstance(c, dict)
            )

            # chart_id returned by save_plotly_chart tool
            if tool_content.startswith("chart_id:"):
                pending_chart_ids.append(tool_content.removeprefix("chart_id:").strip())

            # Correlate back to the sql_db_query that produced this result
            tool_call_id = getattr(msg, "tool_call_id", None)
            if tool_call_id and tool_call_id in sql_by_tool_call_id:
                pending_sql = sql_by_tool_call_id[tool_call_id]

            continue  # never emitted directly

        # ── AIMessage ──────────────────────────────────────────────────
        if msg.type == "ai":
            raw = getattr(msg, "content", "")
            if isinstance(raw, list):
                content = "\n".join(
                    c.get("text", "")
                    for c in raw
                    if isinstance(c, dict) and c.get("type") == "text"
                )
            else:
                content = str(raw)

            has_text = bool(content.strip())
            has_tool_calls = bool(getattr(msg, "tool_calls", []))

            if has_tool_calls and not has_text:
                # Intermediate planning step — skip as a visible turn but
                # SQL index is already built above; nothing more to do here.
                continue

            if has_text:
                # Final (or standalone) AI response — emit with accumulated artefacts
                chat_history.append(CopilotMessageDto(
                    role="agent",
                    content=content,
                    chart_ids=pending_chart_ids,
                    sql_query=pending_sql,
                ))
                # Reset accumulators for the next reasoning chain
                pending_chart_ids = []
                pending_sql = None

            continue

    return chat_history