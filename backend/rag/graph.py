import json
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
CHART_DOMAIN_LIMIT = 8
CHART_DAY_LIMIT = 14
COLLECTION = "domain_timelogs"

CHART_JSON_TOKEN = "<<<CHART_JSON>>>"

SYSTEM_PROMPT = """You answer questions about browsing time using only the provided context.
The context includes domain totals (authoritative for "how much time") and retrieved log snippets.
If the logs do not support an answer, say so. Do not invent domains or durations.
Times in the context are already formatted as days, hours, minutes, and seconds.
Use that same readable format in your answer. Do not reply with raw second counts."""

FILTER_PROMPT = """Extract a date window and site focus from the user's question about browsing logs.
Today is {today} (UTC).
Use inclusive YYYY-MM-DD dates. If they ask about one day, start and end are that day.
If they ask about a month or week, cover the full range.
Leave start/end null if no time period is mentioned.
If they name a site/domain, put it in domain (e.g. youtube.com). Match the named site even from a brand name like YouTube or Gmail."""


class QueryFilters(BaseModel):
    start: Optional[str] = Field(None, description="Inclusive start date YYYY-MM-DD")
    end: Optional[str] = Field(None, description="Inclusive end date YYYY-MM-DD")
    domain: Optional[str] = Field(None, description="Domain mentioned in the question")


class RAGState(TypedDict):
    query: str
    filters: dict
    context: str
    chart: dict
    answer: str


def _format_duration(seconds: float) -> str:
    total = max(0, int(round(float(seconds or 0))))
    days, rem = divmod(total, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if secs or not parts:
        parts.append(f"{secs} second{'s' if secs != 1 else ''}")
    return " ".join(parts)


def _duration_payload(seconds: float) -> dict:
    total = max(0, int(round(float(seconds or 0))))
    days, rem = divmod(total, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    return {
        "seconds": total,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "remainder_seconds": secs,
        "label": _format_duration(total),
    }


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


def _build_aggregates(match: dict) -> tuple[str, dict]:
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

    domain_rows = [
        {"domain": domain, **_duration_payload(seconds)}
        for domain, seconds in sorted(by_domain.items(), key=lambda item: item[1], reverse=True)
    ]
    domain_lines = [f"{row['domain']}: {row['label']}" for row in domain_rows]
    day_rows = []
    day_blocks = []
    for day in sorted(by_day.keys(), reverse=True):
        domains = [
            {"domain": domain, **_duration_payload(seconds)}
            for domain, seconds in sorted(by_day[day].items(), key=lambda item: item[1], reverse=True)
        ]
        day_total = sum(item["seconds"] for item in domains)
        day_payload = {"day": day, "domains": domains, **_duration_payload(day_total)}
        day_rows.append(day_payload)
        rows = [f"  {item['domain']}: {item['label']}" for item in domains]
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

    chart = {
        "window": window,
        "by_domain": domain_rows,
        "by_day": day_rows,
    }
    text = (
        f"Totals ({window}; full Mongo aggregation, not capped at {RETRIEVE_LIMIT}):\n"
        "Totals by domain:\n"
        + ("\n".join(domain_lines) if domain_lines else "(none)")
        + "\n\nTotals by day:\n"
        + ("\n".join(day_blocks) if day_blocks else "(none)")
    )
    return text, chart


def _mentioned_domains(query: str, domains: list[str]) -> list[str]:
    text = (query or "").lower()
    hits = []
    for domain in domains:
        name = (domain or "").lower()
        stem = name.split(".")[0]
        if name and name in text:
            hits.append(domain)
        elif len(stem) >= 4 and stem in text:
            hits.append(domain)
    return hits


def _trim_chart(chart: dict, filters: dict, query: str) -> dict:
    by_domain = list(chart.get("by_domain") or [])
    by_day = list(chart.get("by_day") or [])
    domain_filter = (filters.get("domain") or "").strip().lower()
    focused = []
    if domain_filter:
        focused = [
            row["domain"]
            for row in by_domain
            if domain_filter in (row.get("domain") or "").lower()
        ]
    if not focused:
        focused = _mentioned_domains(query, [row.get("domain") for row in by_domain])

    if focused:
        keep = set(focused)
        by_domain = [row for row in by_domain if row.get("domain") in keep]
    else:
        by_domain = by_domain[:CHART_DOMAIN_LIMIT]
        keep = {row.get("domain") for row in by_domain}

    has_date = bool(filters.get("start") or filters.get("end"))
    if not has_date:
        by_day = by_day[:CHART_DAY_LIMIT]

    trimmed_days = []
    for day in by_day:
        domains = [row for row in (day.get("domains") or []) if row.get("domain") in keep]
        if not domains:
            continue
        total = sum(int(row.get("seconds") or 0) for row in domains)
        trimmed_days.append(
            {
                "day": day.get("day"),
                "domains": domains,
                **_duration_payload(total),
            }
        )

    return {
        "window": chart.get("window"),
        "filters": {
            "start": filters.get("start"),
            "end": filters.get("end"),
            "domain": filters.get("domain"),
        },
        "by_domain": by_domain,
        "by_day": trimmed_days,
    }


def _log_chunk(log: dict) -> str:
    domain = log.get("domain") or "unknown"
    duration = _format_duration(log.get("timeSpent") or 0)
    return f"{_format_ts(log.get('created_at'))} | {domain} | {duration}"


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
    aggregates, chart = _build_aggregates(match)
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
    chart = _trim_chart(chart, state.get("filters") or {}, state.get("query") or "")
    return {"context": context, "chart": chart}


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


def _empty_state(query: str) -> RAGState:
    return {
        "query": query,
        "filters": {},
        "context": "",
        "chart": {"window": "all stored logs", "by_domain": [], "by_day": []},
        "answer": "",
    }


def run_ask(query: str) -> str:
    result = rag_graph.invoke(_empty_state(query))
    return result["answer"]


def _message_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text") or "")
        return "".join(parts)
    return ""


def run_ask_stream(query: str):
    chart = {}
    for mode, chunk in rag_graph.stream(
        _empty_state(query),
        stream_mode=["messages", "updates"],
    ):
        if mode == "updates":
            retrieve_update = chunk.get("retrieve") or {}
            if retrieve_update.get("chart"):
                chart = retrieve_update["chart"]
            continue
        if mode != "messages":
            continue
        message, metadata = chunk
        if metadata.get("langgraph_node") != "generate":
            continue
        text = _message_text(getattr(message, "content", ""))
        if text:
            yield text
    yield CHART_JSON_TOKEN
    yield json.dumps(chart or {})
