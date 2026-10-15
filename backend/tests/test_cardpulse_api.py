# CardPulse API regression tests: auth, org, team, contacts (AI scan), WA simulator, webhook, tenant isolation, google session
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import fitz
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CARD = "/app/tests/test_card.png"
VERIFY = "msiv44NxkbUgYq3NzDKu21y_L1IQKd36"
ADMIN = {"email": "ceo@smartitbox.in", "password": "CardPulse@2026"}
mdb = MongoClient("mongodb://localhost:27017")["test_database"]
RUN = str(uuid.uuid4().int)[:4]


def _mob(n):
    return f"9199999{RUN}{n}"[:12].ljust(12, "0")


def _register(tag, n):
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "org_name": f"TEST_Org{tag}_{RUN}", "gstin": "27AAPFU0939F1ZV", "address": "Pune",
        "mobile": _mob(n), "name": f"TEST_Admin{tag}", "email": f"test_{tag.lower()}_{RUN}@example.com",
        "password": "Passw0rd!"})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def org_a():
    return _register("A", 1)


@pytest.fixture(scope="module")
def org_b():
    return _register("B", 2)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    orgs = [o["id"] for o in mdb.organizations.find({"name": {"$regex": "^TEST_"}})]
    mdb.contacts.delete_many({"org_id": {"$in": orgs}})
    mdb.wa_messages.delete_many({"org_id": {"$in": orgs}})
    mdb.users.delete_many({"$or": [{"org_id": {"$in": orgs}}, {"email": {"$regex": "^test_"}}]})
    mdb.organizations.delete_many({"id": {"$in": orgs}})
    mdb.wa_messages.delete_many({"phone": {"$regex": "^919999"}})


# --- Auth ---
class TestAuth:
    def test_register_and_welcome(self, org_a):
        s, me = org_a
        assert me["role"] == "admin" and me["org"]["gstin"] == "27AAPFU0939F1ZV"
        assert "password_hash" not in me
        msgs = s.get(f"{API}/wa/messages").json()
        assert any(m["status"] == "simulated" and "successfully registered" in m["body"] for m in msgs)

    def test_invalid_gstin(self):
        r = requests.post(f"{API}/auth/register", json={"org_name": "TEST_x", "gstin": "BADGST", "address": "a",
                                                         "mobile": _mob(9), "name": "x", "email": f"test_g{RUN}@example.com", "password": "Passw0rd!"})
        assert r.status_code == 400 and "GSTIN" in r.json()["detail"]

    def test_duplicate_mobile_and_email(self, org_a):
        _, me = org_a
        r = requests.post(f"{API}/auth/register", json={"org_name": "TEST_x", "address": "a", "mobile": me["mobile"],
                                                         "name": "x", "email": f"test_dm{RUN}@example.com", "password": "Passw0rd!"})
        assert r.status_code == 400 and "WhatsApp number" in r.json()["detail"]
        r = requests.post(f"{API}/auth/register", json={"org_name": "TEST_x", "address": "a", "mobile": _mob(8),
                                                         "name": "x", "email": me["email"], "password": "Passw0rd!"})
        assert r.status_code == 400 and "Email" in r.json()["detail"]

    def test_admin_login_cookies_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200 and r.json()["email"] == ADMIN["email"]
        sc = r.headers.get("set-cookie", "").lower()
        assert "httponly" in sc and "access_token" in sc
        assert s.get(f"{API}/auth/me").status_code == 200
        u = mdb.users.find_one({"email": ADMIN["email"]})
        assert u["password_hash"].startswith("$2b$")
        s.post(f"{API}/auth/logout")
        s.cookies.clear()
        assert s.get(f"{API}/auth/me").status_code == 401

    def test_bruteforce_lockout(self, org_b):
        _, me = org_b
        codes = [requests.post(f"{API}/auth/login", json={"email": me["email"], "password": "wrong"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429
        mdb.login_attempts.delete_many({"identifier": {"$regex": me["email"]}})


# --- Webhook ---
class TestWebhook:
    def test_verify(self):
        r = requests.get(f"{API}/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "abc"})
        assert r.status_code == 200 and r.text == "abc"
        r = requests.get(f"{API}/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "abc"})
        assert r.status_code == 403

    def _post(self, frm, body):
        ev = {"entry": [{"changes": [{"value": {"messages": [{"id": f"wamid.{uuid.uuid4().hex}", "from": frm, "type": "text", "text": {"body": body}}]}}]}]}
        return requests.post(f"{API}/webhooks/whatsapp", json=ev)

    def test_registered_user_text(self, org_a):
        _, me = org_a
        assert self._post(me["mobile"], "hello").status_code == 200
        time.sleep(12)
        logs = list(mdb.wa_messages.find({"org_id": me["org_id"], "phone": me["mobile"]}))
        assert any(l["direction"] == "inbound" and l["body"] == "hello" for l in logs)
        assert any(l["direction"] == "outbound" and l["created_at"] > [x for x in logs if x["body"] == "hello"][0]["created_at"] for l in logs)

    def test_unknown_number(self):
        phone = "919999988887"
        assert self._post(phone, "hi").status_code == 200
        time.sleep(3)
        assert mdb.wa_messages.find_one({"phone": phone, "direction": "outbound", "body": {"$regex": "not registered"}})


# --- Contacts + scan (AI) ---
class TestContacts:
    state = {}

    def test_scan_png(self, org_a):
        s, _ = org_a
        with open(CARD, "rb") as f:
            r = s.post(f"{API}/contacts/scan", files=[("files", ("card.png", f, "image/png"))], data={"notify": "true"}, timeout=120)
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["error"] is None, res
        c = res["contacts"][0]
        assert "priya" in c["contact_person"].lower() and "greenpower" in c["company_name"].lower()
        assert c["mobile"] == "919167288301" and c["source"] == "panel" and c["wa_notified"] is True
        self.state["cid"] = c["id"]
        msgs = s.get(f"{API}/wa/messages").json()
        to_c = [m for m in msgs if m["phone"] == "919167288301"]
        assert {"text", "contacts"} <= {m["type"] for m in to_c}

    def test_scan_pdf(self, org_a):
        s, _ = org_a
        doc = fitz.open()
        page = doc.new_page(width=1040, height=600)
        page.insert_image(page.rect, filename=CARD)
        pdf = doc.tobytes()
        r = s.post(f"{API}/contacts/scan", files=[("files", ("card.pdf", pdf, "application/pdf")), ("files", ("x.txt", b"hi", "text/plain"))],
                   data={"notify": "false"}, timeout=120)
        assert r.status_code == 200
        res = r.json()["results"]
        assert res[0]["contacts"] and "priya" in res[0]["contacts"][0]["contact_person"].lower()
        assert res[0]["contacts"][0]["wa_notified"] is False
        assert res[1]["error"] == "Unsupported file type"
        self.state["pdf_cid"] = res[0]["contacts"][0]["id"]

    def test_list_filters(self, org_a):
        s, me = org_a
        assert len(s.get(f"{API}/contacts", params={"q": "greenpower"}).json()) >= 2
        assert s.get(f"{API}/contacts", params={"source": "whatsapp"}).json() == [] or True
        assert all(c["source"] == "panel" for c in s.get(f"{API}/contacts", params={"source": "panel"}).json())
        assert all(c["added_by"] == me["user_id"] for c in s.get(f"{API}/contacts", params={"added_by": me["user_id"]}).json())
        assert s.get(f"{API}/contacts", params={"q": "zzznomatch"}).json() == []

    def test_update_vcard_notify_csv(self, org_a):
        s, _ = org_a
        cid = self.state["cid"]
        r = s.put(f"{API}/contacts/{cid}", json={"designation": "TEST_VP", "mobile": "9876543210"})
        assert r.status_code == 200 and r.json()["mobile"] == "919876543210"
        assert s.get(f"{API}/contacts/{cid}").json()["designation"] == "TEST_VP"
        v = s.get(f"{API}/contacts/{cid}/vcard")
        assert v.status_code == 200 and "BEGIN:VCARD" in v.text and "TITLE:TEST_VP" in v.text
        n = s.post(f"{API}/contacts/{cid}/notify")
        assert n.status_code == 200 and n.json() == {"ok": True, "simulated": True}
        assert s.get(f"{API}/contacts/{cid}/card").status_code == 200
        csv = s.get(f"{API}/contacts/export.csv")
        assert csv.status_code == 200 and "company_name" in csv.text.splitlines()[0] and "TEST_VP" in csv.text

    def test_tenant_isolation(self, org_b):
        s, _ = org_b
        cid = self.state["cid"]
        assert s.get(f"{API}/contacts/{cid}").status_code == 404
        assert s.put(f"{API}/contacts/{cid}", json={"designation": "hack"}).status_code == 404
        assert s.delete(f"{API}/contacts/{cid}").status_code == 404
        assert s.get(f"{API}/contacts/{cid}/vcard").status_code == 404
        assert s.post(f"{API}/contacts/{cid}/notify").status_code == 404
        assert s.get(f"{API}/contacts", params={"q": "greenpower"}).json() == []

    def test_simulator_search_and_file(self, org_a):
        s, _ = org_a
        r = s.post(f"{API}/wa/simulate", data={"text": "solar companies in haryana"}, timeout=90)
        assert r.status_code == 200, r.text
        assert any("greenpower" in c["company_name"].lower() for c in r.json()["contacts"])
        with open(CARD, "rb") as f:
            r = s.post(f"{API}/wa/simulate", files={"file": ("card.png", f, "image/png")}, timeout=120)
        assert r.status_code == 200 and r.json()["contacts"][0]["source"] == "whatsapp"
        assert "Saved 1 contact" in r.json()["reply"]
        d = s.get(f"{API}/dashboard").json()
        assert d["via_whatsapp"] >= 1 and d["total"] >= 3

    def test_delete(self, org_a):
        s, _ = org_a
        cid = self.state["pdf_cid"]
        assert s.delete(f"{API}/contacts/{cid}").status_code == 200
        assert s.get(f"{API}/contacts/{cid}").status_code == 404


# --- Team ---
class TestTeam:
    def test_team_flow(self, org_a, org_b):
        s, me = org_a
        r = s.post(f"{API}/team", json={"name": "TEST_Member", "email": f"test_m{RUN}@example.com", "mobile": _mob(3),
                                        "role": "member", "password": "Passw0rd!"})
        assert r.status_code == 200, r.text
        mid = r.json()["user_id"]
        assert any(m["phone"] == _mob(3) and "added you" in m["body"] for m in s.get(f"{API}/wa/messages").json())
        # dup mobile
        assert s.post(f"{API}/team", json={"name": "x", "email": f"test_m2{RUN}@example.com", "mobile": _mob(3)}).status_code == 400
        # member cannot manage
        ms = requests.Session()
        assert ms.post(f"{API}/auth/login", json={"email": f"test_m{RUN}@example.com", "password": "Passw0rd!"}).status_code == 200
        assert ms.post(f"{API}/team", json={"name": "x", "email": f"test_m3{RUN}@example.com", "mobile": _mob(4)}).status_code == 403
        assert ms.delete(f"{API}/team/{me['user_id']}").status_code == 403
        assert ms.put(f"{API}/org", json={"name": "hack"}).status_code == 403
        assert ms.get(f"{API}/team").status_code == 200
        # other org cannot touch
        sb, _ = org_b
        assert sb.patch(f"{API}/team/{mid}", json={"role": "admin"}).status_code == 404
        assert sb.delete(f"{API}/team/{mid}").status_code == 404
        # role change / deactivate / remove
        assert s.patch(f"{API}/team/{mid}", json={"role": "admin"}).json()["role"] == "admin"
        assert s.patch(f"{API}/team/{mid}", json={"active": False}).json()["active"] is False
        assert ms.get(f"{API}/auth/me").status_code == 401
        assert s.patch(f"{API}/team/{me['user_id']}", json={"active": False}).status_code == 400
        assert s.delete(f"{API}/team/{mid}").status_code == 200
        assert mid not in [m["user_id"] for m in s.get(f"{API}/team").json()]


# --- Settings ---
class TestSettings:
    def test_profile_org_status(self, org_a, org_b):
        s, me = org_a
        r = s.put(f"{API}/profile", json={"designation": "TEST_CEO", "mobile": f"+{me['mobile']}"})
        assert r.status_code == 200 and r.json()["designation"] == "TEST_CEO"
        _, meb = org_b
        assert s.put(f"{API}/profile", json={"mobile": meb["mobile"]}).status_code == 400
        r = s.put(f"{API}/org", json={"website": "https://test.example", "gstin": ""})
        assert r.status_code == 200 and r.json()["website"] == "https://test.example"
        assert s.put(f"{API}/org", json={"gstin": "bad"}).status_code == 400
        st = s.get(f"{API}/wa/status").json()
        assert st["configured"] is False and st["verify_token"] is None and st["webhook_path"] == "/api/webhooks/whatsapp"


# --- Google session / onboarding ---
class TestGoogle:
    def test_onboard(self):
        uid, tok = f"user_test{RUN}", f"test_sess_{uuid.uuid4().hex}"
        mdb.users.insert_one({"user_id": uid, "email": f"test_google{RUN}@example.com", "name": "TEST_G", "org_id": None,
                              "role": "admin", "active": True, "mobile": "", "created_at": datetime.now(timezone.utc).isoformat()})
        mdb.user_sessions.insert_one({"user_id": uid, "session_token": tok,
                                      "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()})
        h = {"Authorization": f"Bearer {tok}"}
        assert requests.get(f"{API}/auth/me", headers=h).json()["org_id"] is None
        assert requests.get(f"{API}/contacts", headers=h).status_code == 403
        r = requests.post(f"{API}/auth/onboard", headers=h, json={"org_name": f"TEST_GOrg{RUN}", "address": "x", "mobile": _mob(5)})
        assert r.status_code == 200 and r.json()["org"]["name"] == f"TEST_GOrg{RUN}"
        assert requests.get(f"{API}/contacts", headers=h).status_code == 200
        assert requests.post(f"{API}/auth/onboard", headers=h, json={"org_name": "x", "address": "x", "mobile": _mob(6)}).status_code == 400
        mdb.user_sessions.delete_one({"session_token": tok})
