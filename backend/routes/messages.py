import random
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import config
from database import get_db
from messaging.providers import choose_provider, refresh_plan_status
from messaging.templates import REPLY_MEANINGS
from models import Contact, FarmerOrganization, Message, SeasonPlan
from routes.tanks import tank_display_name

router = APIRouter(tags=["messages"])

SIMULATED_REPLY_TEXTS = {
    "1": ["1", "1 - wagaa kala", "1 planted"],
    "2": ["2", "2 not yet", "2 - wathura madi"],
    "3": ["3", "3 crop failed", "3 - wagawa nasthi una"],
}


class SimulatedReplyInput(BaseModel):
    organization_id: int | None = None
    reply_code: str | None = None


def phone_digits(phone):
    return "".join(character for character in phone or "" if character.isdigit())


def parse_reply_code(text):
    match = re.match(r"^\s*([123])\b", text or "")
    return match.group(1) if match else None


def find_contact_by_phone(db, phone):
    digits = phone_digits(phone)
    if not digits:
        return None
    for contact in db.query(Contact).all():
        if phone_digits(contact.phone)[-9:] == digits[-9:]:
            return contact
    return None


def latest_plan_for_contact(db, contact):
    if contact is None:
        return None
    return (
        db.query(SeasonPlan)
        .filter(SeasonPlan.organization_id == contact.organization_id)
        .order_by(SeasonPlan.created_at.desc())
        .first()
    )


def store_inbound_message(db, phone, text, channel, provider_message_id=None):
    contact = find_contact_by_phone(db, phone)
    plan_row = latest_plan_for_contact(db, contact)
    reply_code = parse_reply_code(text)
    message = Message(
        contact_id=contact.id if contact else None,
        plan_id=plan_row.id if plan_row else None,
        direction="inbound",
        channel=channel,
        text=text,
        status="received" if reply_code else "unparsed",
        provider_message_id=provider_message_id,
        from_phone=phone,
        reply_code=reply_code,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def message_payload(message):
    contact = message.contact
    organization = contact.organization if contact else None
    return {
        "id": message.id,
        "direction": message.direction,
        "channel": message.channel,
        "text": message.text,
        "status": message.status,
        "reply_code": message.reply_code,
        "reply_meaning": REPLY_MEANINGS.get(message.reply_code),
        "from_phone": message.from_phone or (contact.phone if contact else None),
        "contact_name": contact.name if contact else None,
        "organization_id": organization.id if organization else None,
        "organization_name": organization.name if organization else None,
        "tank_id": organization.tank_id if organization else None,
        "tank_name": tank_display_name(organization.tank) if organization else None,
        "plan_id": message.plan_id,
        "season": message.plan.season if message.plan else None,
        "provider_message_id": message.provider_message_id,
        "created_at": message.created_at.isoformat(),
    }


def reply_summary(messages):
    counts = {meaning: 0 for meaning in REPLY_MEANINGS.values()}
    counts["unmatched"] = 0
    for message in messages:
        if message.direction != "inbound":
            continue
        if message.contact_id is None:
            counts["unmatched"] += 1
        meaning = REPLY_MEANINGS.get(message.reply_code)
        if meaning:
            counts[meaning] += 1
    return counts


def pick_simulation_contact(db, organization_id):
    query = db.query(Contact).join(FarmerOrganization)
    if organization_id:
        query = query.filter(Contact.organization_id == organization_id)
    contacts = query.all()
    if not contacts:
        raise HTTPException(status_code=400, detail="Register an organization with contacts first")
    contacts_with_plans = [contact for contact in contacts if latest_plan_for_contact(db, contact)]
    return random.choice(contacts_with_plans or contacts)


def twilio_reply_xml():
    return Response(content="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", media_type="application/xml")


def whatsapp_text_messages(payload):
    found = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                found.append(
                    {
                        "phone": message.get("from", ""),
                        "text": message.get("text", {}).get("body", ""),
                        "id": message.get("id"),
                    }
                )
    return found


@router.get("/messages")
def list_messages(direction: str | None = Query(None, pattern="^(inbound|outbound)$"), db: Session = Depends(get_db)):
    query = db.query(Message)
    if direction:
        query = query.filter(Message.direction == direction)
    messages = query.order_by(Message.created_at.desc(), Message.id.desc()).limit(500).all()
    return {"summary": reply_summary(messages), "messages": [message_payload(message) for message in messages]}


@router.post("/messages/simulate-reply")
def simulate_reply(data: SimulatedReplyInput | None = None, db: Session = Depends(get_db)):
    data = data or SimulatedReplyInput()
    contact = pick_simulation_contact(db, data.organization_id)
    reply_code = data.reply_code if data.reply_code in REPLY_MEANINGS else random.choice(list(REPLY_MEANINGS))
    text = random.choice(SIMULATED_REPLY_TEXTS[reply_code])
    message = store_inbound_message(db, contact.phone, text, contact.channel, "simulated")
    return message_payload(message)


@router.post("/webhooks/sms")
async def sms_webhook(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        payload = dict(await request.form())
    phone = payload.get("From") or payload.get("from") or ""
    text = payload.get("Body") or payload.get("body") or payload.get("text") or ""
    store_inbound_message(db, phone, text, "sms", payload.get("MessageSid"))
    return twilio_reply_xml()


@router.get("/webhooks/whatsapp")
def whatsapp_verify(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == config.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    stored = [
        store_inbound_message(db, item["phone"], item["text"], "whatsapp", item["id"]).id
        for item in whatsapp_text_messages(payload)
    ]
    if not stored and payload.get("from"):
        stored.append(store_inbound_message(db, payload["from"], payload.get("text", ""), "whatsapp").id)
    return {"stored": stored}


def resend_outbound_message(db, original):
    contact = original.contact
    if contact is None:
        raise HTTPException(status_code=400, detail="The contact for this message was removed")
    if not contact.opted_in:
        raise HTTPException(status_code=400, detail="This contact has not agreed to receive messages")
    result = choose_provider(contact.channel).send_message(contact.phone, original.text, contact.channel)
    message = Message(
        contact_id=contact.id,
        plan_id=original.plan_id,
        direction="outbound",
        channel=contact.channel,
        text=original.text,
        status=result["status"],
        provider_message_id=result["provider_message_id"],
    )
    db.add(message)
    db.flush()
    if original.plan_id:
        refresh_plan_status(db, original.plan_id)
    return message


@router.post("/messages/{message_id}/resend")
def resend_message(message_id: int, db: Session = Depends(get_db)):
    original = db.get(Message, message_id)
    if original is None or original.direction != "outbound":
        raise HTTPException(status_code=404, detail="Outbound message not found")
    message = resend_outbound_message(db, original)
    db.commit()
    db.refresh(message)
    return message_payload(message)


@router.delete("/messages/{message_id}")
def delete_outbound_message(message_id: int, db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if message is None or message.direction != "outbound":
        raise HTTPException(status_code=404, detail="Outbound message not found")
    if message.status == "queued":
        raise HTTPException(status_code=409, detail="Wait until the message finishes sending before deleting it")
    db.delete(message)
    db.commit()
    return {"deleted": message_id}
