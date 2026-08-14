from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from config.config import OPENAI_API_KEY, OPENAI_MODEL, db

RETRIEVE_LIMIT = 2000
TOP_K = 8
COLLECTION = "domain_timelogs"

SYSTEM_PROMPT = """You answer questions about browsing time using only the provided context.
The context includes domain totals (authoritative for "how much time") and retrieved log snippets.
If the logs do not support an answer, say so. Do not invent domains or durations.
Times are in seconds unless you convert them for readability."""

FILTER_PROMPT = """Extract a date window from the user's question about browsing logs.
Today is {today} (UTC).
Use inclusive YYYY-MM-DD dates. If they ask about one day, start and end are that day.
If they ask about a month or week, cover the full range.
Leave start/end null if no time period is mentioned.
If they name a site/domain, put it in domain (e.g. youtube.com)."""


class QueryFilters(BaseModel):
    start: Optional[str] = Field(None, description="Inclusive start date YYYY-MM-DD")
    end: Optional[str] = Field(None, description="Inclusive end date YYYY-MM-DD")
    domain: Optional[str] = Field(None, description="Domain mentioned in the question")


class RAGState(TypedDict):
    query: str
    filters: dict
    context: str
    answer: str


def _format_ts(value) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    if value:
        return str(value)
    return "unknown-time"


def _parse_day(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _mongo_match(filters: dict) -> dict:
    match: dict = {}
    start = _parse_day(filters.get("start"))
    end = _parse_day(filters.get("end"))
    created: dict = {}
    if start:
        created["$gte"] = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    if end:
        created["$lt"] = datetime(end.year, end.month, end.day, tzinfo=timezone.utc) + timedelta(
            days=1
        )
    if created:
        match["created_at"] = created
    domain = (filters.get("domain") or "").strip()
    if domain:
        match["domain"] = {"$regex": domain, "$options": "i"}
    return match


def _load_logs(match: dict) -> list[dict]:
    query = match or {}
    return list(
        db[COLLECTION]
        .find(query, {"domain": 1, "timeSpent": 1, "created_at": 1, "_id": 0})
        .sort("created_at", -1)
        .limit(RETRIEVE_LIMIT)
    )


def _build_aggregates(match: dict) -> str:
    pipeline = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append(
        {
            "$group": {
                "_id": {
                    "day": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at",
                            "timezone": "UTC",
                        }
                    },
                    "domain": {"$ifNull": ["$domain", "unknown"]},
                },
                "seconds": {"$sum": {"$ifNull": ["$timeSpent", 0]}},
            }
        }
    )

    by_domain: dict[str, float] = defaultdict(float)
    by_day: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for row in db[COLLECTION].aggregate(pipeline):
        key = row.get("_id") or {}
        domain = key.get("domain") or "unknown"
        day = key.get("day") or "unknown-day"
        seconds = float(row.get("seconds") or 0)
        by_domain[domain] += seconds
        by_day[day][domain] += seconds

    domain_lines = [
        f"{domain}: {int(seconds)}s"
        for domain, seconds in sorted(by_domain.items(), key=lambda item: item[1], reverse=True)
    ]
    day_blocks = []
    for day in sorted(by_day.keys(), reverse=True):
        rows = [
            f"  {domain}: {int(seconds)}s"
            for domain, seconds in sorted(by_day[day].items(), key=lambda item: item[1], reverse=True)
        ]
        day_blocks.append(f"{day}:\n" + "\n".join(rows))

    window = "all stored logs"
    if match.get("created_at") or match.get("domain"):
        start = match.get("created_at", {}).get("$gte")
        end = match.get("created_at", {}).get("$lt")
        parts = []
        if start:
            parts.append(f"from {start.date()}")
        if end:
            parts.append(f"until {(end - timedelta(days=1)).date()}")
        if match.get("domain"):
            parts.append(f"domain ~ {match['domain'].get('$regex')}")
        window = " ".join(parts) if parts else window

    return (
        f"Totals ({window}; full Mongo aggregation, not capped at {RETRIEVE_LIMIT}):\n"
        "Totals by domain:\n"
        + ("\n".join(domain_lines) if domain_lines else "(none)")
        + "\n\nTotals by day:\n"
        + ("\n".join(day_blocks) if day_blocks else "(none)")
    )


def _log_chunk(log: dict) -> str:
    domain = log.get("domain") or "unknown"
    seconds = int(float(log.get("timeSpent") or 0))
    return f"{_format_ts(log.get('created_at'))} | {domain} | {seconds}s"


def _retrieve_chunks(query: str, logs: list[dict]) -> str:
    if not logs:
        return "(no matching log snippets)"

    documents = [Document(page_content=_log_chunk(log)) for log in logs]
    store = InMemoryVectorStore.from_documents(
        documents,
        embedding=OpenAIEmbeddings(api_key=OPENAI_API_KEY),
    )
    hits = store.similarity_search(query, k=min(TOP_K, len(documents)))
    if not hits:
        return "(no matching log snippets)"
    return "\n".join(doc.page_content for doc in hits)


def parse_filters(state: RAGState) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    llm = ChatOpenAI(model=OPENAI_MODEL, api_key=OPENAI_API_KEY, temperature=0)
    extractor = llm.with_structured_output(QueryFilters)
    parsed = extractor.invoke(
        [
            SystemMessage(content=FILTER_PROMPT.format(today=today)),
            HumanMessage(content=state["query"]),
        ]
    )
    return {
        "filters": {
            "start": parsed.start,
            "end": parsed.end,
            "domain": parsed.domain,
        }
    }


def retrieve(state: RAGState) -> dict:
    match = _mongo_match(state.get("filters") or {})
    aggregates = _build_aggregates(match)
    logs = _load_logs(match)
    snippets = _retrieve_chunks(state["query"], logs)
    note = ""
    if logs and len(logs) >= RETRIEVE_LIMIT:
        note = (
            f"\n\nNote: snippet search used the newest {RETRIEVE_LIMIT} matching logs; "
            "domain/day totals above still include every matching document."
        )
    context = (
        f"{aggregates}\n\nRetrieved log snippets:\n{snippets}{note}"
        if logs or "(none)" not in aggregates
        else "No domain time logs were found."
    )
    return {"context": context}


def generate(state: RAGState) -> dict:
    llm = ChatOpenAI(model=OPENAI_MODEL, api_key=OPENAI_API_KEY, temperature=0)
    response = llm.invoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=f"Question: {state['query']}\n\nContext:\n{state['context']}"
            ),
        ]
    )
    return {"answer": response.content}


def build_graph():
    graph = StateGraph(RAGState)
    graph.add_node("parse_filters", parse_filters)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate", generate)
    graph.add_edge(START, "parse_filters")
    graph.add_edge("parse_filters", "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


rag_graph = build_graph()


def run_ask(query: str) -> str:
    result = rag_graph.invoke(
        {"query": query, "filters": {}, "context": "", "answer": ""}
    )
    return result["answer"]
