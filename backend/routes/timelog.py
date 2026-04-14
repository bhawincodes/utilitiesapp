from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from config.config import db
from dependencies import get_current_user
from model.model import TimeLog

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
