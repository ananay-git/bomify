"""
Copilot Services — LangGraph ReAct agent with PostgresSaver memory.

Architecture:
  - Uses langchain-community's SQLDatabaseToolkit
  - Adds a custom `save_plotly_chart` tool writing safely out to `copilot_charts` PostgreSQL table
  - Uses `AsyncPostgresSaver` utilizing `psycopg_pool` to inherently handle cross-session continuity.
"""

import logging
import time
import uuid
import json
from pathlib import Path

from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.utilities import SQLDatabase
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from app.core.config import settings
from app.core.database import async_session
from app.modules.copilot.models import CopilotThread, CopilotChart
from app.modules.copilot.schemas import CopilotQueryRequest, CopilotQueryResponse
import asyncio

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singletons (Initialized Lazily to strictly respect asyncio loop)
# ---------------------------------------------------------------------------
_agent = None
_llm = None


def _get_llm():
    """Lazily create the LLM singleton so the module can be imported
    even when GROQ_API_KEY is not set (other modules keep working)."""
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model=settings.COPILOT_AGENT_MODEL,
            # temperature=settings.COPILOT_AGENT_TEMPERATURE,
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
        )
    return _llm


@tool
async def save_plotly_chart(plotly_json: str) -> str:
    """Save a complete Plotly figure JSON to disk and return its chart ID.

    Call this whenever the user requests a chart or visualisation.
    plotly_json must be a JSON string representing a full Plotly figure
    object with 'data' (list of traces) and 'layout' keys.

    Returns: a string like "chart_id:<uuid>" that identifies the saved file.
    """
    chart_id = str(uuid.uuid4())
    logger.debug("save_plotly_chart called", extra={"chart_id": chart_id})

    try:
        parsed = json.loads(plotly_json)
    except Exception as exc:
        logger.warning(
            "save_plotly_chart received invalid JSON from agent",
            extra={"chart_id": chart_id, "error": str(exc)},
        )
        parsed = {"error": "invalid json provided by agent"}

    async with async_session() as session:
        chart = CopilotChart(id=chart_id, plotly_json=parsed)
        session.add(chart)
        await session.commit()

    logger.info("Chart saved to DB", extra={"chart_id": chart_id})
    return f"chart_id:{chart_id}"


prompt_path = Path(__file__).parent / "PROMPT.md"
system_prompt = (
    prompt_path.read_text(encoding="utf-8")
    if prompt_path.exists()
    else "You are QuadStack Copilot, an AI assistant."
)


async def get_agent():
    global _agent
    if _agent is None:
        logger.info("Initialising agent singleton...")

        def _setup_langchain():
            db = SQLDatabase.from_uri(settings.COPILOT_DATABASE_URL)
            llm = _get_llm()
            sql_tools = SQLDatabaseToolkit(db=db, llm=llm).get_tools()
            return create_react_agent(
                model=llm,
                tools=sql_tools + [save_plotly_chart],
                checkpointer=MemorySaver(),
                prompt=system_prompt,
            )

        _agent = await asyncio.to_thread(_setup_langchain)
        logger.info("Agent singleton ready")
    return _agent


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class CopilotService:
    @staticmethod
    async def process_query(
        request: CopilotQueryRequest, user_id: int
    ) -> CopilotQueryResponse:
        logger.info(
            "Processing query", extra={"query": request.query, "user_id": user_id}
        )
        agent = await get_agent()
        logger.info("Agent ready")
        # ── 1. Thread resolution ───────────────────────────────────────────
        thread_id = request.thread_id
        is_new_thread = not bool(thread_id)

        if is_new_thread:
            thread_id = str(uuid.uuid4())
            title = request.query[:60] + ("..." if len(request.query) > 60 else "")
            logger.info(
                "New thread created",
                extra={"thread_id": thread_id, "user_id": user_id, "title": title},
            )
            async with async_session() as session:
                new_thread = CopilotThread(
                    thread_id=thread_id, user_id=user_id, title=title
                )
                session.add(new_thread)
                await session.commit()
            logger.debug("Thread persisted to DB", extra={"thread_id": thread_id})
        else:
            logger.info(
                "Resuming existing thread",
                extra={"thread_id": thread_id, "user_id": user_id},
            )

        config = {"configurable": {"thread_id": thread_id}}

        # ── 2. Invoke agent ────────────────────────────────────────────────
        logger.info(
            "Agent invocation started",
            extra={
                "thread_id": thread_id,
                "user_id": user_id,
                "query_length": len(request.query),
            },
        )

        start_ts = time.monotonic()

        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": request.query}]},
            config,
        )

        elapsed = time.monotonic() - start_ts
        messages = result["messages"]

        logger.info(
            "Agent invocation complete",
            extra={
                "thread_id": thread_id,
                "elapsed_seconds": round(elapsed, 3),
                "message_count": len(messages),
            },
        )

        # ── 3. Extract final text ──────────────────────────────────────────
        final_msg_content = messages[-1].content
        if isinstance(final_msg_content, str):
            final_text = final_msg_content
        elif isinstance(final_msg_content, list):
            texts = []
            for block in final_msg_content:
                if isinstance(block, dict) and block.get("type") == "text":
                    texts.append(block.get("text", ""))
                elif isinstance(block, str):
                    texts.append(block)
            final_text = "\n".join(texts)
        else:
            final_text = str(final_msg_content)

        logger.debug(
            "Final text extracted",
            extra={"thread_id": thread_id, "response_length": len(final_text)},
        )

        # ── 4. Collect chart IDs from the current turn ─────────────────────
        current_turn_msgs = []
        for msg in reversed(messages):
            if getattr(msg, "type", "") == "human":
                break
            current_turn_msgs.insert(0, msg)

        chart_ids: list[str] = []
        for msg in current_turn_msgs:
            content = getattr(msg, "content", "")
            if isinstance(content, str) and content.startswith("chart_id:"):
                chart_id = content.removeprefix("chart_id:").strip()
                if chart_id not in chart_ids:
                    chart_ids.append(chart_id)
                logger.debug(
                    "Chart ID collected",
                    extra={"thread_id": thread_id, "chart_id": chart_id},
                )

        if chart_ids:
            logger.info(
                "Charts generated",
                extra={"thread_id": thread_id, "chart_count": len(chart_ids)},
            )

        # ── 5. Grab the SQL queries for transparency ───────────────────────
        queries: list[str] = []
        for msg in current_turn_msgs:
            for tc in getattr(msg, "tool_calls", []):
                if tc.get("name") == "sql_db_query":
                    q = tc.get("args", {}).get("query")
                    if q and q not in queries:
                        queries.append(q)

        generated_sql: str | None = (
            "\n\n-- Next Query --\n".join(queries) if queries else None
        )

        if generated_sql:
            logger.info(
                "SQL query captured",
                extra={
                    "thread_id": thread_id,
                    "sql_length": len(generated_sql),
                    "sql_preview": generated_sql[:120].replace("\n", " "),
                },
            )
        else:
            logger.debug(
                "No SQL query found in tool calls",
                extra={"thread_id": thread_id},
            )

        # ── 6. Return ──────────────────────────────────────────────────────
        return CopilotQueryResponse(
            natural_language_summary=final_text,
            generated_sql=generated_sql,
            chart_files=chart_ids,
            thread_id=thread_id,
        )
