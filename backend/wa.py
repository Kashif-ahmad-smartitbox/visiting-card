import os
import logging

import httpx

from core import db, new_id, now

log = logging.getLogger("wa")


def configured():
    return bool(os.environ.get("WA_PHONE_NUMBER_ID") and os.environ.get("WA_ACCESS_TOKEN"))


def _url(path):
    return f"https://graph.facebook.com/{os.environ['WA_GRAPH_VERSION']}/{path}"


def _headers():
    return {"Authorization": f"Bearer {os.environ['WA_ACCESS_TOKEN']}"}


async def log_message(org_id, direction, phone, mtype, body, status, error=None, user_id=None):
    doc = {"id": new_id("msg"), "org_id": org_id, "direction": direction, "phone": phone,
           "type": mtype, "body": body, "status": status, "error": error,
           "user_id": user_id, "created_at": now()}
    await db.wa_messages.insert_one(doc.copy())
    return doc


async def _send(org_id, to, mtype, part, preview):
    if not to:
        return None
    if not configured():
        return await log_message(org_id, "outbound", to, mtype, preview, "simulated")
    payload = {"messaging_product": "whatsapp", "recipient_type": "individual",
               "to": to, "type": mtype, mtype: part}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(_url(f"{os.environ['WA_PHONE_NUMBER_ID']}/messages"),
                             headers=_headers(), json=payload)
        if r.is_error:
            log.warning("WA send failed %s %s", r.status_code, r.text[:300])
            return await log_message(org_id, "outbound", to, mtype, preview, "failed", r.text[:500])
        return await log_message(org_id, "outbound", to, mtype, preview, "sent")
    except httpx.HTTPError as e:
        return await log_message(org_id, "outbound", to, mtype, preview, "failed", str(e))


async def send_text(org_id, to, body):
    return await _send(org_id, to, "text", {"preview_url": False, "body": body}, body)


async def send_contact(org_id, to, c):
    name = c.get("name") or c.get("company") or "Contact"
    contact = {"name": {"formatted_name": name, "first_name": name.split(" ")[0]}}
    if c.get("phone"):
        contact["phones"] = [{"phone": "+" + c["phone"], "type": "WORK", "wa_id": c["phone"]}]
    if c.get("email"):
        contact["emails"] = [{"email": c["email"], "type": "WORK"}]
    if c.get("company") or c.get("title"):
        contact["org"] = {"company": c.get("company") or "", "title": c.get("title") or ""}
    preview = " | ".join(x for x in ["[vCard] " + name, c.get("title"), c.get("company"),
                                     ("+" + c["phone"]) if c.get("phone") else "", c.get("email")] if x)
    return await _send(org_id, to, "contacts", [contact], preview)


async def download_media(media_id):
    async with httpx.AsyncClient(timeout=90) as c:
        meta = await c.get(_url(media_id), headers=_headers())
        meta.raise_for_status()
        data = await c.get(meta.json()["url"], headers=_headers())
        data.raise_for_status()
        return data.content, data.headers.get("content-type", "application/octet-stream").split(";")[0]
