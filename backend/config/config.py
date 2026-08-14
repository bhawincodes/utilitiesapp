import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

url = "mongodb://localhost:27017"

client = MongoClient(url)
db = client["myneedsapp"]

try:
    client.admin.command("ping")
    print("Pinged your command. you are successfully connected to MongoDB!")
except Exception as e:
    print(e)
