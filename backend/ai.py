import asyncio
import base64
import io
import json
import os
import subprocess
import tempfile
import uuid

import fitz
import imageio_ffmpeg
from PIL import Image, ImageOps
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai import OpenAISpeechToText

MODEL = ("openai", "gpt-5.5")

EXTRACT_PROMPT = """You extract data from business/visiting card images.
Return ONLY JSON: {"cards":[{"company_name":"","contact_person":"","designation":"","email":"","mobile":"","other_phones":"","address":"","website":"","confidence":0.0}]}
Rules: one object per distinct person/card. If images show front and back of the same card, merge them into one.
mobile = primary mobile number with country code if visible. other_phones = other numbers comma separated.
Use "" for missing fields. confidence 0-1. If no business card is visible return {"cards":[]}."""

QUERY_PROMPT = """You convert a WhatsApp request for business contacts into search keywords.
Return ONLY JSON: {"intent":"search"|"help"|"greeting","keywords":[]}
keywords: lowercase words/short phrases that may appear in a company name, person name, designation, city/address, email or website.
Add helpful singular forms and common synonyms (e.g. "ca" -> "chartered accountant"). Max 8.
Ignore filler like details, contact, number, send, please, me, of, need."""


def _norm_image(raw):
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    im.thumbnail((1600, 1600))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def to_images(data, mime):
    if mime == "application/pdf":
        doc = fitz.open(stream=data, filetype="pdf")
        return [_norm_image(p.get_pixmap(dpi=150).tobytes("png")) for p in list(doc)[:4]]
    return [_norm_image(data)]


def parse_json(text):
    s = text.strip()
    start, end = s.find("{"), s.rfind("}")
    return json.loads(s[start:end + 1]) if start != -1 else {}


def _chat(system):
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=uuid.uuid4().hex,
                   system_message=system).with_model(*MODEL)


async def extract_cards(data, mime):
    images = await asyncio.to_thread(to_images, data, mime)
    msg = UserMessage(text="Extract the visiting card details.",
                      file_contents=[ImageContent(image_base64=i) for i in images])
    resp = await _chat(EXTRACT_PROMPT).send_message(msg)
    return parse_json(resp).get("cards", [])


async def parse_query(text):
    resp = await _chat(QUERY_PROMPT).send_message(UserMessage(text=text))
    q = parse_json(resp)
    return {"intent": q.get("intent", "search"), "keywords": [k.lower() for k in q.get("keywords", []) if k]}


def _to_mp3(data):
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "in"), os.path.join(d, "out.mp3")
        with open(src, "wb") as f:
            f.write(data)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", src, dst], check=True, capture_output=True)
        with open(dst, "rb") as f:
            return f.read()


async def transcribe(data):
    mp3 = await asyncio.to_thread(_to_mp3, data)
    stt = OpenAISpeechToText(api_key=os.environ["EMERGENT_LLM_KEY"])
    f = io.BytesIO(mp3)
    f.name = "voice.mp3"
    resp = await stt.transcribe(file=f, model="whisper-1", response_format="json")
    return resp.text
