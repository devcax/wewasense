import logging

import requests

import config
from models import SeasonPlan

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


class NotConfiguredProvider:
    name = "not_configured"

    def send_message(self, phone, text, channel):
        logger.warning("No %s keys in .env, message to %s was not sent", channel, phone)
        return {"status": "failed", "provider_message_id": None}


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
    return NotConfiguredProvider()


def provider_summary():
    return {
        "sms": "twilio_sms" if config.has_twilio_keys() else "not_configured",
        "whatsapp": "whatsapp_cloud" if config.has_whatsapp_keys() else "not_configured",
    }


def send_message(phone, text, channel):
    return choose_provider(channel).send_message(phone, text, channel)
