from pydantic import BaseModel
from typing import Optional


class User(BaseModel):
    email: str
    name: str
    phone_number: Optional[str] = None
