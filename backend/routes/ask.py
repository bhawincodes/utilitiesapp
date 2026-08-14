from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from rag.graph import run_ask

endpoints = APIRouter()


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1)


class AskResponse(BaseModel):
    answer: str


@endpoints.post("/ask", response_model=AskResponse)
def ask(body: AskRequest):
    try:
        answer = run_ask(body.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to answer query: {str(e)}")
    return {"answer": answer}
