from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from fastapi import (APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, HTTPException,
                     Query, Request, Response, UploadFile)
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, EmailStr
from starlette.middleware.cors import CORSMiddleware

import wa
from core import (USER_PROJ, db, client, decode_token, get_admin, get_current_user, get_org_user, hash_password,
                  new_id, normalize_phone, now, set_access_cookie, set_auth_cookies, verify_password)
from pipeline import (ALLOWED, UPLOAD_DIR, get_org, handle_file, handle_query, handle_voice, notify_contact,
                      process_inbound, save_cards)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")
GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
ORG_PROJ = {"_id": 0}


# ---------- models ----------
class OrgIn(BaseModel):
    org_name: str
    gstin: str = ""
    address: str
    mobile: str


class RegisterIn(OrgIn):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    designation: Optional[str] = None


class MemberIn(BaseModel):
    name: str
    email: EmailStr
    mobile: str
    role: str = "member"
    designation: str = ""
    password: Optional[str] = None


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class ContactUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    other_phones: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None


class QueryIn(BaseModel):
    text: str


# ---------- helpers ----------
def require_text(**fields):
    for k, v in fields.items():
        if v is not None and not v.strip():
            raise HTTPException(400, f"{k.replace('_', ' ').capitalize()} is required")


def clean_gstin(g):
    g = (g or "").strip().upper()
    if g and not GSTIN_RE.match(g):
        raise HTTPException(400, "Invalid GSTIN format (e.g. 24AAACA1234A1Z5)")
    return g


async def ensure_mobile_free(mobile, exclude_user_id=None):
    if not mobile or len(mobile) < 11:
        raise HTTPException(400, "Enter a valid mobile number with country code")
    q = {"mobile": mobile}
    if exclude_user_id:
        q["user_id"] = {"$ne": exclude_user_id}
    if await db.users.find_one(q):
        raise HTTPException(400, "This WhatsApp number is already registered to another user")


async def create_org(data: OrgIn, email):
    require_text(organisation_name=data.org_name, address=data.address)
    mobile = normalize_phone(data.mobile)
    org = {"id": new_id("org"), "name": data.org_name.strip(), "gstin": clean_gstin(data.gstin),
           "address": data.address.strip(), "mobile": mobile, "email": email, "website": "", "created_at": now()}
    await db.organizations.insert_one(org.copy())
    return org


def welcome_text(user, org, added_by=None):
    intro = (f"{added_by} added you to *{org['name']}* on CardPulse." if added_by
             else f"Your organisation *{org['name']}* is successfully registered on CardPulse.")
    return (f"Hello {user['name']}!\n\n{intro}\n\n"
            "Send a photo or PDF of any visiting card to this number and it will be saved to your organisation automatically.\n"
            "Send a text or voice note like \"solar companies in Gujarat\" to search your contacts.")


async def me_payload(user):
    org = await get_org(user["org_id"]) if user.get("org_id") else None
    return {**user, "org": org, "is_platform_owner": user["email"] == os.environ["PLATFORM_OWNER_EMAIL"].lower()}


# ---------- auth ----------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    require_text(name=data.name, organisation_name=data.org_name, address=data.address)
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    mobile = normalize_phone(data.mobile)
    await ensure_mobile_free(mobile)
    org = await create_org(data, email)
    user = {"user_id": new_id("user"), "org_id": org["id"], "name": data.name.strip(), "email": email,
            "mobile": mobile, "role": "admin", "designation": "", "auth_provider": "password",
            "password_hash": hash_password(data.password), "active": True, "created_at": now()}
    await db.users.insert_one(user.copy())
    await wa.send_text(org["id"], mobile, welcome_text(user, org))
    set_auth_cookies(response, user["user_id"])
    user.pop("password_hash")
    return await me_payload(user)


@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5:
        locked = datetime.fromisoformat(att["last"]) + timedelta(minutes=15)
        if locked > datetime.now(timezone.utc):
            raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": ident})
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(data.password, user.get("password_hash")):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"last": now()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    if user.get("active") is False:
        raise HTTPException(403, "Your account is deactivated")
    await db.login_attempts.delete_one({"identifier": ident})
    set_auth_cookies(response, user["user_id"])
    user.pop("password_hash", None)
    return await me_payload(user)


@api.post("/auth/google/session")
async def google_session(data: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": data.session_id})
    if r.is_error:
        raise HTTPException(401, "Invalid Google session")
    g = r.json()
    email = g["email"].lower()
    user = await db.users.find_one({"email": email}, USER_PROJ)
    if user and user.get("active") is False:
        raise HTTPException(403, "Your account is deactivated")
    if not user:
        user = {"user_id": new_id("user"), "org_id": None, "name": g.get("name") or email, "email": email,
                "mobile": "", "role": "admin", "designation": "", "auth_provider": "google",
                "picture": g.get("picture"), "active": True, "created_at": now()}
        await db.users.insert_one(user.copy())
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": g.get("picture")}})
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": g["session_token"],
                                       "expires_at": expires.isoformat(), "created_at": now()})
    response.set_cookie("session_token", g["session_token"], httponly=True, secure=True, samesite="none",
                        max_age=604800, path="/")
    return await me_payload(user)


@api.post("/auth/onboard")
async def onboard(data: OrgIn, user=Depends(get_current_user)):
    if user.get("org_id"):
        raise HTTPException(400, "Already onboarded")
    mobile = normalize_phone(data.mobile)
    await ensure_mobile_free(mobile, user["user_id"])
    org = await create_org(data, user["email"])
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"org_id": org["id"], "mobile": mobile, "role": "admin"}})
    user.update(org_id=org["id"], mobile=mobile, role="admin")
    await wa.send_text(org["id"], mobile, welcome_text(user, org))
    return await me_payload(user)


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return await me_payload(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    uid = decode_token(request.cookies.get("refresh_token") or "", "refresh")
    if not uid or not await db.users.find_one({"user_id": uid, "active": {"$ne": False}}):
        raise HTTPException(401, "Invalid refresh token")
    set_access_cookie(response, uid)
    return {"ok": True}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- profile / org ----------
@api.put("/profile")
async def update_profile(data: ProfileUpdate, user=Depends(get_org_user)):
    upd = {k: v.strip() for k, v in data.model_dump(exclude_none=True).items()}
    require_text(name=data.name)
    if "mobile" in upd:
        upd["mobile"] = normalize_phone(upd["mobile"])
        await ensure_mobile_free(upd["mobile"], user["user_id"])
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return await me_payload(await db.users.find_one({"user_id": user["user_id"]}, USER_PROJ))


@api.put("/org")
async def update_org(data: OrgUpdate, user=Depends(get_admin)):
    upd = {k: v.strip() for k, v in data.model_dump(exclude_none=True).items()}
    require_text(organisation_name=data.name)
    if "gstin" in upd:
        upd["gstin"] = clean_gstin(upd["gstin"])
    if upd.get("mobile"):
        upd["mobile"] = normalize_phone(upd["mobile"])
        if len(upd["mobile"]) < 11:
            raise HTTPException(400, "Enter a valid mobile number with country code")
    if upd:
        await db.organizations.update_one({"id": user["org_id"]}, {"$set": upd})
    return await get_org(user["org_id"])


# ---------- team ----------
@api.get("/team")
async def list_team(user=Depends(get_org_user)):
    members = await db.users.find({"org_id": user["org_id"]}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    counts = {c["_id"]: c["n"] async for c in db.contacts.aggregate([
        {"$match": {"org_id": user["org_id"]}}, {"$group": {"_id": "$added_by", "n": {"$sum": 1}}}])}
    for m in members:
        m["contacts_added"] = counts.get(m["user_id"], 0)
    return members


@api.post("/team")
async def add_member(data: MemberIn, user=Depends(get_admin)):
    email = data.email.lower()
    require_text(name=data.name)
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    if data.role not in ("admin", "member"):
        raise HTTPException(400, "Invalid role")
    mobile = normalize_phone(data.mobile)
    await ensure_mobile_free(mobile)
    member = {"user_id": new_id("user"), "org_id": user["org_id"], "name": data.name.strip(), "email": email,
              "mobile": mobile, "role": data.role, "designation": data.designation.strip(),
              "auth_provider": "password" if data.password else "google", "active": True, "created_at": now()}
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        member["password_hash"] = hash_password(data.password)
    await db.users.insert_one(member.copy())
    org = await get_org(user["org_id"])
    await wa.send_text(org["id"], mobile, welcome_text(member, org, added_by=user["name"]))
    member.pop("password_hash", None)
    member["contacts_added"] = 0
    return member


async def _org_member(user, member_id):
    m = await db.users.find_one({"user_id": member_id, "org_id": user["org_id"]}, {"_id": 0, "password_hash": 0})
    if not m:
        raise HTTPException(404, "Member not found")
    return m


@api.patch("/team/{member_id}")
async def update_member(member_id: str, data: MemberUpdate, user=Depends(get_admin)):
    target = await _org_member(user, member_id)
    upd = data.model_dump(exclude_none=True)
    require_text(name=data.name)
    if target["role"] == "admin" and (upd.get("role") == "member" or upd.get("active") is False):
        if await db.users.count_documents({"org_id": user["org_id"], "role": "admin", "active": {"$ne": False}}) <= 1:
            raise HTTPException(400, "At least one active admin is required")
    if member_id == user["user_id"] and (upd.get("role") == "member" or upd.get("active") is False):
        raise HTTPException(400, "You cannot demote or deactivate yourself")
    if "role" in upd and upd["role"] not in ("admin", "member"):
        raise HTTPException(400, "Invalid role")
    if "mobile" in upd:
        upd["mobile"] = normalize_phone(upd["mobile"])
        await ensure_mobile_free(upd["mobile"], member_id)
    if "password" in upd:
        if len(upd["password"]) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        upd["password_hash"] = hash_password(upd.pop("password"))
    if upd:
        await db.users.update_one({"user_id": member_id}, {"$set": upd})
    return await _org_member(user, member_id)


@api.delete("/team/{member_id}")
async def delete_member(member_id: str, user=Depends(get_admin)):
    if member_id == user["user_id"]:
        raise HTTPException(400, "You cannot remove yourself")
    await _org_member(user, member_id)
    await db.users.delete_one({"user_id": member_id})
    return {"ok": True}


# ---------- contacts ----------
def contact_query(user, q=None, source=None, added_by=None):
    f = {"org_id": user["org_id"]}
    if source and source != "all":
        f["source"] = source
    if added_by and added_by != "all":
        f["added_by"] = added_by
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        f["$or"] = [{k: rx} for k in ("company_name", "contact_person", "designation", "email", "mobile", "address")]
    return f


@api.get("/contacts")
async def list_contacts(q: str = "", source: str = "all", added_by: str = "all", user=Depends(get_org_user)):
    return await db.contacts.find(contact_query(user, q, source, added_by), {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.get("/contacts/export.csv")
async def export_csv(user=Depends(get_org_user)):
    rows = await db.contacts.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    cols = ["company_name", "contact_person", "designation", "email", "mobile", "other_phones", "address",
            "website", "source", "added_by_name", "created_at"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=contacts.csv"})


async def _contact(user, cid):
    c = await db.contacts.find_one({"id": cid, "org_id": user["org_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contact not found")
    return c


@api.get("/contacts/{cid}")
async def get_contact(cid: str, user=Depends(get_org_user)):
    return await _contact(user, cid)


@api.put("/contacts/{cid}")
async def update_contact(cid: str, data: ContactUpdate, user=Depends(get_org_user)):
    await _contact(user, cid)
    upd = {k: v.strip() for k, v in data.model_dump(exclude_none=True).items()}
    if "mobile" in upd:
        upd["mobile"] = normalize_phone(upd["mobile"])
    if upd:
        await db.contacts.update_one({"id": cid}, {"$set": upd})
    return await _contact(user, cid)


@api.delete("/contacts/{cid}")
async def delete_contact(cid: str, user=Depends(get_org_user)):
    c = await _contact(user, cid)
    if user["role"] != "admin" and c["added_by"] != user["user_id"]:
        raise HTTPException(403, "Only admins or the person who added it can delete this contact")
    await db.contacts.delete_one({"id": cid})
    return {"ok": True}


@api.get("/contacts/{cid}/card")
async def contact_card(cid: str, user=Depends(get_org_user)):
    c = await _contact(user, cid)
    path = UPLOAD_DIR / c.get("card_file", "")
    if not c.get("card_file") or not path.is_file():
        raise HTTPException(404, "Card file not available")
    return FileResponse(path, media_type=c.get("card_mime"))


@api.get("/contacts/{cid}/vcard")
async def contact_vcard(cid: str, user=Depends(get_org_user)):
    c = await _contact(user, cid)
    lines = ["BEGIN:VCARD", "VERSION:3.0", f"FN:{c.get('contact_person') or c.get('company_name')}",
             f"ORG:{c.get('company_name', '')}", f"TITLE:{c.get('designation', '')}"]
    if c.get("mobile"):
        lines.append(f"TEL;TYPE=CELL:+{c['mobile']}")
    if c.get("email"):
        lines.append(f"EMAIL:{c['email']}")
    if c.get("address"):
        lines.append(f"ADR;TYPE=WORK:;;{c['address'].replace(chr(10), ' ')};;;;")
    if c.get("website"):
        lines.append(f"URL:{c['website']}")
    lines.append("END:VCARD")
    name = re.sub(r"[^A-Za-z0-9]+", "_", c.get("contact_person") or "contact")
    return Response("\r\n".join(lines), media_type="text/vcard",
                    headers={"Content-Disposition": f"attachment; filename={name}.vcf"})


@api.post("/contacts/{cid}/notify")
async def renotify(cid: str, user=Depends(get_org_user)):
    c = await _contact(user, cid)
    if not c.get("mobile"):
        raise HTTPException(400, "Contact has no mobile number")
    ok = await notify_contact(user, await get_org(user["org_id"]), c)
    return {"ok": ok, "simulated": not wa.configured()}


@api.post("/contacts/scan")
async def scan_cards(files: List[UploadFile] = File(...), notify: bool = Form(True), user=Depends(get_org_user)):
    sem = asyncio.Semaphore(3)

    async def one(f: UploadFile):
        data = await f.read()
        mime = f.content_type or ""
        if mime not in ALLOWED:
            return {"filename": f.filename, "error": "Unsupported file type", "contacts": []}
        if len(data) > 15 * 1024 * 1024:
            return {"filename": f.filename, "error": "File larger than 15 MB", "contacts": []}
        async with sem:
            try:
                saved = await save_cards(user, data, mime, "panel", notify)
                return {"filename": f.filename, "contacts": saved,
                        "error": None if saved else "No visiting card detected"}
            except Exception as e:
                logger.exception("Extraction failed")
                return {"filename": f.filename, "error": f"Extraction failed: {e}", "contacts": []}

    return {"results": await asyncio.gather(*[one(f) for f in files]), "simulated": not wa.configured()}


# ---------- dashboard ----------
@api.get("/dashboard")
async def dashboard(user=Depends(get_org_user)):
    oid = user["org_id"]
    week = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    total, via_wa, via_panel, this_week, notified, team = await asyncio.gather(
        db.contacts.count_documents({"org_id": oid}),
        db.contacts.count_documents({"org_id": oid, "source": "whatsapp"}),
        db.contacts.count_documents({"org_id": oid, "source": "panel"}),
        db.contacts.count_documents({"org_id": oid, "created_at": {"$gte": week}}),
        db.contacts.count_documents({"org_id": oid, "wa_notified": True}),
        db.users.count_documents({"org_id": oid}),
    )
    recent = await db.contacts.find({"org_id": oid}, {"_id": 0}).sort("created_at", -1).to_list(6)
    msgs = await db.wa_messages.find({"org_id": oid}, {"_id": 0}).sort("created_at", -1).to_list(8)
    return {"total": total, "via_whatsapp": via_wa, "via_panel": via_panel, "this_week": this_week,
            "notified": notified, "team": team, "recent_contacts": recent, "recent_messages": msgs,
            "wa_configured": wa.configured()}


# ---------- whatsapp ----------
@api.get("/wa/status")
async def wa_status(user=Depends(get_org_user)):
    owner = user["email"] == os.environ["PLATFORM_OWNER_EMAIL"].lower()
    pid = os.environ.get("WA_PHONE_NUMBER_ID", "")
    return {"configured": wa.configured(), "phone_number_id": (pid[:4] + "****") if pid else "",
            "signature_check": bool(os.environ.get("WA_APP_SECRET")), "webhook_path": "/api/webhooks/whatsapp",
            "verify_token": os.environ["WA_VERIFY_TOKEN"] if owner else None}


@api.get("/wa/messages")
async def wa_messages(direction: str = "all", user=Depends(get_org_user)):
    f = {"org_id": user["org_id"]}
    if direction != "all":
        f["direction"] = direction
    return await db.wa_messages.find(f, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/wa/simulate")
async def wa_simulate(text: str = Form(""), file: Optional[UploadFile] = File(None), user=Depends(get_org_user)):
    if not user.get("mobile"):
        raise HTTPException(400, "Add your WhatsApp mobile number in Settings first")
    if file is not None:
        data = await file.read()
        mime = (file.content_type or "").split(";")[0]
        if mime.startswith("audio/") or mime == "video/webm":
            await wa.log_message(user["org_id"], "inbound", user["mobile"], "audio", "[voice note]", "simulated", user_id=user["user_id"])
            return await handle_voice(user, data)
        await wa.log_message(user["org_id"], "inbound", user["mobile"], "document" if mime == "application/pdf" else "image",
                             f"[{file.filename}]", "simulated", user_id=user["user_id"])
        return await handle_file(user, data, mime)
    if not text.strip():
        raise HTTPException(400, "Send a text, voice note or card file")
    await wa.log_message(user["org_id"], "inbound", user["mobile"], "text", text, "simulated", user_id=user["user_id"])
    return await handle_query(user, text)


@api.get("/webhooks/whatsapp", response_class=PlainTextResponse)
async def wa_verify(hub_mode: str = Query(None, alias="hub.mode"),
                    hub_verify_token: str = Query(None, alias="hub.verify_token"),
                    hub_challenge: str = Query(None, alias="hub.challenge")):
    if hub_mode == "subscribe" and hmac.compare_digest(hub_verify_token or "", os.environ["WA_VERIFY_TOKEN"]):
        return hub_challenge or ""
    raise HTTPException(403, "Verification failed")


@api.post("/webhooks/whatsapp")
async def wa_webhook(request: Request, background: BackgroundTasks):
    raw = await request.body()
    secret = os.environ.get("WA_APP_SECRET")
    if secret:
        expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(request.headers.get("x-hub-signature-256", ""), expected):
            raise HTTPException(401, "Invalid signature")
    event = json.loads(raw or b"{}")
    for entry in event.get("entry", []):
        for change in entry.get("changes", []):
            for m in change.get("value", {}).get("messages", []):
                if not m.get("id") or await db.webhook_events.find_one({"event_id": m["id"]}):
                    continue
                await db.webhook_events.insert_one({"event_id": m["id"], "created_at": now()})
                background.add_task(process_inbound, m)
    return {"ok": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ["CORS_ORIGINS"].split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("mobile")
    await db.organizations.create_index("id", unique=True)
    await db.contacts.create_index([("org_id", 1), ("created_at", -1)])
    await db.wa_messages.create_index([("org_id", 1), ("created_at", -1)])
    await db.webhook_events.create_index("event_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.user_sessions.create_index("session_token")
    email, pwd = os.environ["ADMIN_EMAIL"].lower(), os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        org = {"id": new_id("org"), "name": "SmartITBox", "gstin": "", "address": "", "mobile": "",
               "email": email, "website": "", "created_at": now()}
        await db.organizations.insert_one(org.copy())
        await db.users.insert_one({"user_id": new_id("user"), "org_id": org["id"], "name": "Admin", "email": email,
                                   "mobile": "", "role": "admin", "designation": "", "auth_provider": "password",
                                   "password_hash": hash_password(pwd), "active": True, "created_at": now()})
    elif not verify_password(pwd, existing.get("password_hash")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
