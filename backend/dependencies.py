import os

from dotenv import load_dotenv
from fastapi import Header, HTTPException
from jose import jwt

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALG = "HS256"


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload
