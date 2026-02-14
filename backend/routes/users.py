from fastapi import APIRouter, Depends

from config.config import db
from dependencies import get_current_user
from model.model import User

endpoints = APIRouter()

@endpoints.post("/user")
def create_or_skip_user(user: User, current_user=Depends(get_current_user)):
    users_collection = db["users"]
    existing = users_collection.find_one({"email": user.email})
    if existing:
        return {"message": "User already exists", "status": "skipped"}
    users_collection.insert_one(user.model_dump())
    return {"message": "User created", "status": "created"}
