import os
import re
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_ALG = "HS256"
USER_PROJ = {"_id": 0, "password_hash": 0}


def now():
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def normalize_phone(raw):
    if not raw:
        return ""
    d = re.sub(r"\D", "", str(raw)).lstrip("0")
    if len(d) == 10:
        d = os.environ["DEFAULT_COUNTRY_CODE"] + d
    return d


def hash_password(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p, h):
    return bool(h) and bcrypt.checkpw(p.encode(), h.encode())


def _token(sub, typ, delta):
    payload = {"sub": sub, "type": typ, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def decode_token(token, typ):
    try:
        p = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
        return p["sub"] if p.get("type") == typ else None
    except jwt.InvalidTokenError:
        return None


def set_auth_cookies(resp, user_id):
    opts = dict(httponly=True, secure=True, samesite="none", path="/")
    resp.set_cookie("access_token", _token(user_id, "access", timedelta(minutes=15)), max_age=900, **opts)
    resp.set_cookie("refresh_token", _token(user_id, "refresh", timedelta(days=7)), max_age=604800, **opts)


def set_access_cookie(resp, user_id):
    resp.set_cookie("access_token", _token(user_id, "access", timedelta(minutes=15)), max_age=900,
                    httponly=True, secure=True, samesite="none", path="/")


async def _session_user_id(token):
    s = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not s:
        return None
    exp = s["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return s["user_id"] if exp > datetime.now(timezone.utc) else None


async def get_current_user(request: Request):
    header = request.headers.get("Authorization", "")
    bearer = header[7:] if header.startswith("Bearer ") else None
    uid = None
    access = request.cookies.get("access_token") or bearer
    if access:
        uid = decode_token(access, "access")
    if not uid:
        st = request.cookies.get("session_token") or bearer
        if st:
            uid = await _session_user_id(st)
    if not uid:
        raise HTTPException(401, "Not authenticated")
    user = await db.users.find_one({"user_id": uid, "active": {"$ne": False}}, USER_PROJ)
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_org_user(user=Depends(get_current_user)):
    if not user.get("org_id"):
        raise HTTPException(403, "Complete organisation onboarding first")
    return user


async def get_admin(user=Depends(get_org_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user
