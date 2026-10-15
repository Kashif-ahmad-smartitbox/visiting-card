import logging
import mimetypes
from pathlib import Path

import wa
from ai import extract_cards, parse_query, transcribe
from core import db, new_id, now, normalize_phone

log = logging.getLogger("pipeline")
UPLOAD_DIR = Path(__file__).parent / "uploads"
FIELDS = ["company_name", "contact_person", "designation", "email", "other_phones", "address", "website"]
SEARCH_FIELDS = ["company_name", "contact_person", "designation", "email", "address", "website", "mobile"]
ALLOWED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

HELP = ("Hi! I'm your CardPulse assistant.\n\n"
        "- Send a *photo or PDF* of a visiting card to save it to your organisation.\n"
        "- Send a *text or voice note* like \"solar companies in Gujarat\" to search your contacts.")


async def get_org(org_id):
    return await db.organizations.find_one({"id": org_id}, {"_id": 0})


def _store_file(org_id, data, mime):
    folder = UPLOAD_DIR / org_id
    folder.mkdir(parents=True, exist_ok=True)
    name = new_id("card") + (mimetypes.guess_extension(mime) or "")
    (folder / name).write_bytes(data)
    return f"{org_id}/{name}"


def org_profile_text(org, adder, contact_name):
    lines = [f"Hello {contact_name or 'there'},", "",
             f"{adder['name']} from *{org['name']}* has just saved your business card. Here is their company profile:", "",
             f"*{org['name']}*"]
    for label, key in [("Address", "address"), ("GSTIN", "gstin"), ("Phone", "mobile"), ("Email", "email")]:
        if org.get(key):
            val = ("+" + org[key]) if key == "mobile" else org[key]
            lines.append(f"{label}: {val}")
    lines += ["", f"{adder['name']}'s contact card is attached below. Looking forward to connecting!"]
    return "\n".join(lines)


def adder_card(adder, org):
    return {"name": adder["name"], "phone": adder.get("mobile"), "email": adder.get("email"),
            "company": org["name"], "title": adder.get("designation") or ""}


async def notify_contact(adder, org, contact):
    to = contact.get("mobile")
    if not to:
        return False
    r = await wa.send_text(org["id"], to, org_profile_text(org, adder, contact.get("contact_person")))
    await wa.send_contact(org["id"], to, adder_card(adder, org))
    ok = bool(r and r["status"] in ("sent", "simulated"))
    await db.contacts.update_one({"id": contact["id"]}, {"$set": {"wa_notified": ok}})
    return ok


async def save_cards(user, data, mime, source, notify=True):
    cards = await extract_cards(data, mime)
    if not cards:
        return []
    path = _store_file(user["org_id"], data, mime)
    org = await get_org(user["org_id"])
    saved = []
    for card in cards:
        doc = {"id": new_id("ct"), "org_id": user["org_id"],
               **{f: str(card.get(f) or "").strip() for f in FIELDS},
               "mobile": normalize_phone(card.get("mobile")),
               "confidence": float(card.get("confidence") or 0),
               "source": source, "added_by": user["user_id"], "added_by_name": user["name"],
               "card_file": path, "card_mime": mime, "wa_notified": False, "created_at": now()}
        await db.contacts.insert_one(doc.copy())
        if notify:
            doc["wa_notified"] = await notify_contact(user, org, doc)
        saved.append(doc)
    return saved


async def search_contacts(org_id, keywords):
    docs = await db.contacts.find({"org_id": org_id}, {"_id": 0}).to_list(5000)
    scored = []
    for d in docs:
        hay = " ".join(str(d.get(f, "")) for f in SEARCH_FIELDS).lower()
        primary = f"{d.get('company_name', '')} {d.get('contact_person', '')}".lower()
        score = sum((2 if k in primary else 1) for k in keywords if k in hay)
        if score:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:5]]


def format_results(query, results):
    if not results:
        return f"No contacts found for \"{query}\". Try different keywords."
    out = [f"Found {len(results)} contact(s) for \"{query}\":", ""]
    for i, c in enumerate(results, 1):
        out.append(f"{i}. *{c.get('contact_person') or c.get('company_name')}*" +
                   (f" - {c['designation']}" if c.get("designation") else ""))
        for label, key in [("Company", "company_name"), ("Mobile", "mobile"), ("Email", "email"), ("Address", "address")]:
            if c.get(key):
                out.append(f"   {label}: {'+' + c[key] if key == 'mobile' else c[key]}")
        out.append("")
    return "\n".join(out).strip()


async def handle_query(user, text):
    q = await parse_query(text)
    if q["intent"] != "search" or not q["keywords"]:
        await wa.send_text(user["org_id"], user.get("mobile"), HELP)
        return {"reply": HELP, "contacts": [], "keywords": []}
    results = await search_contacts(user["org_id"], q["keywords"])
    reply = format_results(text, results)
    await wa.send_text(user["org_id"], user.get("mobile"), reply)
    for c in results[:3]:
        await wa.send_contact(user["org_id"], user.get("mobile"),
                              {"name": c.get("contact_person"), "phone": c.get("mobile"), "email": c.get("email"),
                               "company": c.get("company_name"), "title": c.get("designation")})
    return {"reply": reply, "contacts": results, "keywords": q["keywords"]}


def saved_summary(org, contacts):
    if not contacts:
        return "I couldn't detect a visiting card in this file. Please send a clearer photo or PDF."
    lines = [f"Saved {len(contacts)} contact(s) to *{org['name']}*:"]
    for c in contacts:
        lines.append(f"- {c.get('contact_person') or '-'} | {c.get('company_name') or '-'}" +
                     (f" | +{c['mobile']}" if c.get("mobile") else ""))
    if any(c.get("wa_notified") for c in contacts):
        lines.append("\nThe contact(s) received your company profile and vCard on WhatsApp.")
    return "\n".join(lines)


async def handle_file(user, data, mime, notify=True):
    if mime not in ALLOWED:
        reply = "Please send a visiting card as a JPG/PNG photo or a PDF."
        await wa.send_text(user["org_id"], user.get("mobile"), reply)
        return {"reply": reply, "contacts": []}
    contacts = await save_cards(user, data, mime, "whatsapp", notify)
    reply = saved_summary(await get_org(user["org_id"]), contacts)
    await wa.send_text(user["org_id"], user.get("mobile"), reply)
    return {"reply": reply, "contacts": contacts}


async def handle_voice(user, data):
    text = (await transcribe(data)).strip()
    if not text:
        reply = "Sorry, I couldn't understand the voice note."
        await wa.send_text(user["org_id"], user.get("mobile"), reply)
        return {"reply": reply, "contacts": [], "transcript": ""}
    res = await handle_query(user, text)
    res["transcript"] = text
    return res


async def process_inbound(m):
    phone = m.get("from", "")
    typ = m.get("type")
    user = await db.users.find_one({"mobile": phone, "active": {"$ne": False}}, {"_id": 0, "password_hash": 0})
    body = m.get("text", {}).get("body") if typ == "text" else f"[{typ}]"
    await wa.log_message(user["org_id"] if user else None, "inbound", phone, typ, body, "received",
                         user_id=user["user_id"] if user else None)
    if not user or not user.get("org_id"):
        await wa.send_text(None, phone, "This WhatsApp number is not registered with CardPulse. Ask your organisation admin to add you.")
        return
    try:
        if typ in ("image", "document"):
            data, mime = await wa.download_media(m[typ]["id"])
            await handle_file(user, data, mime)
        elif typ == "audio":
            data, _ = await wa.download_media(m["audio"]["id"])
            await handle_voice(user, data)
        elif typ == "text":
            await handle_query(user, m["text"]["body"])
        else:
            await wa.send_text(user["org_id"], phone, HELP)
    except Exception:
        log.exception("Inbound processing failed")
        await wa.send_text(user["org_id"], phone, "Something went wrong while processing your message. Please try again.")
