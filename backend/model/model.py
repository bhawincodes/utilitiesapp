

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class User(BaseModel):
    email: str
    name: str
    phone_number: Optional[str] = None


class TimeLog(BaseModel):
    seconds: float
    email: Optional[str] = None
    created_at: Optional[datetime] = None

