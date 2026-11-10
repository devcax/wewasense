import logging
import threading
import uuid

import requests

import config
from database import SessionLocal
from models import Message, SeasonPlan

MOCK_FAILING_PHONE_SUFFIX = "0000"
REQUEST_TIMEOUT_SECONDS = 15
logger = logging.getLogger("wewasense.messaging")


def digits_only(phone):
    return "".join(character for character in phone if character.isdigit())


def latest_outbound_statuses(plan):
    latest = {}
    for message in sorted(plan.messages, key=lambda item: item.id):
        if message.direction == "outbound":
            latest[message.contact_id] = message.status
    return list(latest.values())


def refresh_plan_status(session, plan_id):
    plan = session.get(SeasonPlan, plan_id)
    if plan is None:
        return
    statuses = latest_outbound_statuses(plan)
    if not statuses or "queued" in statuses:
        return
    plan.status = "failed" if "failed" in statuses else "sent"


def finish_mock_delivery(provider_message_id, final_status):
    session = SessionLocal()
    try:
        message = session.query(Message).filter(Message.provider_message_id == provider_message_id).first()
        if message is None:
            return
        message.status = final_status
        if message.plan_id:
            session.flush()
            refresh_plan_status(session, message.plan_id)
        session.commit()
    finally:
        session.close()


class MockProvider:
    name = "mock"

    def send_message(self, phone, text, channel):
        provider_message_id = f"mock-{uuid.uuid4().hex[:12]}"
        final_status = "failed" if digits_only(phone).endswith(MOCK_FAILING_PHONE_SUFFIX) else "sent"
        timer = threading.Timer(
            config.MOCK_SEND_DELAY_SECONDS, finish_mock_delivery, args=(provider_message_id, final_status)
        )
        timer.daemon = True
        timer.start()
        return {"status": "queued", "provider_message_id": provider_message_id}


class TwilioSmsProvider:
    name = "twilio_sms"

    def send_message(self, phone, text, channel):
        url = f"https://api.twilio.com/2010-04-01/Accounts/{config.TWILIO_ACCOUNT_SID}/Messages.json"
        try:
            response = requests.post(
                url,
                data={"To": phone, "From": config.TWILIO_FROM_NUMBER, "Body": text},
                auth=(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except requests.RequestException:
            return {"status": "failed", "provider_message_id": None}
        if response.status_code >= 300:
            return {"status": "failed", "provider_message_id": None}
        return {"status": "sent", "provider_message_id": response.json().get("sid")}


class WhatsAppCloudProvider:
    name = "whatsapp_cloud"

    def send_message(self, phone, text, channel):
        url = (
            f"https://graph.facebook.com/{config.WHATSAPP_API_VERSION}/"
            f"{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
        )
        payload = {
            "messaging_product": "whatsapp",
            "to": digits_only(phone),
            "type": "text",
            "text": {"body": text},
        }
        headers = {"Authorization": f"Bearer {config.WHATSAPP_ACCESS_TOKEN}"}
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
        except requests.RequestException as error:
            logger.error("WhatsApp request failed: %s", error)
            return {"status": "failed", "provider_message_id": None}
        if response.status_code >= 300:
            logger.error("WhatsApp send rejected (%s): %s", response.status_code, response.text)
            return {"status": "failed", "provider_message_id": None}
        message_ids = response.json().get("messages") or [{}]
        return {"status": "sent", "provider_message_id": message_ids[0].get("id")}


def choose_provider(channel):
    if channel == "whatsapp" and config.has_whatsapp_keys():
        return WhatsAppCloudProvider()
    if channel == "sms" and config.has_twilio_keys():
        return TwilioSmsProvider()
    return MockProvider()


def provider_summary():
    return {
        "sms": "twilio_sms" if config.has_twilio_keys() else "mock",
        "whatsapp": "whatsapp_cloud" if config.has_whatsapp_keys() else "mock",
    }


def send_message(phone, text, channel):
    return choose_provider(channel).send_message(phone, text, channel)


def finish_stale_mock_messages():
    session = SessionLocal()
    try:
        stale_ids = [
            message.provider_message_id
            for message in session.query(Message).filter(
                Message.status == "queued", Message.provider_message_id.like("mock-%")
            )
        ]
    finally:
        session.close()
    for provider_message_id in stale_ids:
        finish_mock_delivery(provider_message_id, "sent")
