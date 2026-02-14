import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from jose import jwt
from datetime import datetime, timedelta
import httpx
from dotenv import load_dotenv

from dependencies import get_current_user
from routes.routes import endpoints
from routes.users import endpoints as user_endpoints

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = "http://localhost:8000/auth/google/callback"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"  # email + profile [web:6]

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALG = "HS256"
JWT_EXP_MIN = 60

app = FastAPI()

app.include_router(endpoints)
app.include_router(user_endpoints)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/auth/google/url")
async def get_google_oauth_url():
    scope = "openid email profile"
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return {"url": f"{GOOGLE_AUTH_URL}?{params}"}

@app.get("/auth/google/callback")
async def google_callback(code: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID, 
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get token")

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    async with httpx.AsyncClient() as client:
        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if userinfo_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info")

    userinfo = userinfo_res.json()
    # userinfo has id, email, name, picture, etc. [web:6][web:9]

    # TODO: create/find user in DB here

    payload = {
        "sub": str(userinfo["id"]),
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXP_MIN),
    }
    app_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    print(payload)

    # For SPA, better to redirect back to React with token in query or fragment
    redirect_url = f"http://localhost:5173/auth/callback?token={app_token}"
    return RedirectResponse(redirect_url)

@app.get("/me")
async def me(user=Depends(get_current_user)):
    return user
