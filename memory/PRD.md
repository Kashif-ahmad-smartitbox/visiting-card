# CardPulse — PRD

## Original problem statement
i wan to design a tool which will be as SAAS based so client will register his/herself like organisation name| Gst Details | Address | Mobile No.
this details will be for Admin and now other users can also add in it
when this onboarded registered user will get WA notification of Successfull registered
now but i want when that whatsapp number registered person will sent Visiting Card Details like photo or pdf or direct access by camera, and they sent then system will recongnise who did it and save these record in there organisation panel
my system will extract details like
Company Name | Address if any |Contact PersonNAme | Email Id |Mobile No. | Designantion
and store in db with ref of added by
also once these details get fetched contact person will get immediate WA notification with Company Profile and Vcard of Added by person
Same these details we can access by any time from anywhere
same features we need on panel so when user Upload single or multiple Visiting card system will auto extract data and store it
also in future when ever any person wants any Business Contact Details he/she will sent Voice note or text over the WA and My System will filter out that details and reply to searcher

## User choices
- WhatsApp: Meta WhatsApp Cloud API (keys to be added later; SIMULATION mode until then), free-form text now, templates later
- AI: GPT-5.5 (Emergent key) for card extraction + query parsing; Whisper for voice notes
- Auth: JWT email/password + Emergent Google login

## Architecture
- FastAPI: core.py (db, auth), wa.py (Meta Graph send/download, simulated logging), ai.py (GPT-5.5 vision, PDF->image via PyMuPDF, ffmpeg+whisper), pipeline.py (save cards, dedupe, notify, search, inbound handler), server.py (routes)
- One platform WhatsApp number; sender identified by users.mobile -> org
- Mongo: organizations, users, user_sessions, contacts, wa_messages, webhook_events, login_attempts
- React dark UI (CardPulse): Landing, Register, Login, Onboarding, Dashboard, Scan, Contacts, Team, WA Simulator, WhatsApp Logs, Settings

## Personas
Org admin (registers, manages team), team member (sends cards over WhatsApp, searches), contact (receives profile + vCard)

## Implemented (2026-10-15)
- Org registration with GSTIN validation, WA welcome; Google login + onboarding
- Team management (admin), WA welcome to members, last-admin protection
- Panel bulk upload (image/PDF/camera) -> AI extraction -> stored with added_by, dedupe by mobile/email
- Contact WA notification: company profile text + adder vCard
- Contacts directory: search/filters, edit, vCard, CSV export, re-notify, delete
- WhatsApp webhook (verify + signature + dedupe) handling image/PDF/voice/text; text/voice search replies with vCards
- WA Simulator in panel; WhatsApp logs; Settings (profile, org, WA status)
- Tested: iteration_1 (all flows pass; brute-force + validation fixes applied after)

## Backlog
- P0: Add Meta keys (WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_APP_SECRET) and register webhook
- P1: Approved Meta templates for out-of-24h messages; persistent object storage for card files
- P2: Subscription plans/billing, duplicate merge UI, analytics
