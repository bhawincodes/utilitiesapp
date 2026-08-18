from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config.config import db
from dependencies import get_current_user
from rag.graph import run_ask_stream

COLLECTION = "ask_queries"
endpoints = APIRouter()
class AskRequest(BaseModel):
    query: str = Field(..., min_length=1)


def _serialize_query(doc: dict) -> dict:
    created = doc.get("created_at")
    return {
        "id": str(doc.get("_id")),
        "query": doc.get("query") or "",
        "email": doc.get("email"),
        "created_at": created.isoformat() if created else None,
    }


@endpoints.post("/ask")
def ask(body: AskRequest, current_user=Depends(get_current_user)):
    query = body.query.strip()
    try:
        db[COLLECTION].insert_one(
            {
                "query": query,
                "email": current_user.get("email"),
                "created_at": datetime.now(timezone.utc),
            }
        )
        return StreamingResponse(
            run_ask_stream(query),
            media_type="text/plain",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to answer query: {str(e)}")


@endpoints.get("/ask/history")
def ask_history(current_user=Depends(get_current_user)):
    try:
        docs = (
            db[COLLECTION]
            .find({"email": current_user.get("email")})
            .sort("created_at", -1)
            .limit(100)
        )
        return [_serialize_query(doc) for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load queries: {str(e)}")
