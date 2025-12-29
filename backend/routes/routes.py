from fastapi import APIRouter

endpoints = APIRouter()

@endpoints.get("/")
def home():
    return {
        "status": "OK",
        "message": "My fast api is running"
    }
