from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from config.config import db
from dependencies import get_current_user
from model.model import DomainTimeLog, TimeLog

endpoints = APIRouter()

@endpoints.post("/logtime")
def logTime(timelog: TimeLog, current_user=Depends(get_current_user)):
    print(current_user)
    timelog_collection = db["timelogs"]
    timelog.created_at = datetime.now(timezone.utc)
    timelog.email = current_user['email']
    try:
        timelog_collection.insert_one(timelog.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert timelog: {str(e)}")
    return {"message": "Timelog Added", "status": "created"}


@endpoints.post("/domain-time")
def log_domain_time(entry: DomainTimeLog):
    print(f"[domain-time] {entry.domain} -> {entry.timeSpent}s")
    collection = db["domain_timelogs"]
    entry.created_at = datetime.now(timezone.utc)
    try:
        collection.insert_one(entry.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert domain timelog: {str(e)}")
    return {"message": "Domain time logged", "status": "created"}
