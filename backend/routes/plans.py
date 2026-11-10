from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from messaging.providers import choose_provider
from messaging.templates import render_plan_message, supported_language
from models import FarmerOrganization, Message, SeasonPlan, TankForecast
from plan_service import build_plan_for_tank
from routes.tanks import forecast_from_row, tank_display_name
from seasons import resolve_season, season_label_for_key

router = APIRouter(prefix="/plans", tags=["plans"])

LOCKED_STATUSES = ("approved", "sent")
SENDABLE_STATUSES = ("approved", "failed", "sent")


class PlanTextInput(BaseModel):
    message_text: str = Field(min_length=1)


def primary_contact(organization):
    opted_in = [contact for contact in organization.contacts if contact.opted_in]
    return (opted_in or organization.contacts or [None])[0]


def plan_inputs(db, organization, season_key):
    tank = organization.tank
    forecast_row = db.query(TankForecast).filter_by(tank_id=tank.tank_id, season_key=resolve_season(season_key)["key"]).first()
    forecast = forecast_from_row(tank, season_key, forecast_row)
    if forecast["forecast_mid_season_fill_percent"] is None:
        raise HTTPException(status_code=409, detail=f"No stored forecast for tank {tank.tank_id}; compute forecasts before generating plans.")
    plan = build_plan_for_tank(tank.area_ha, forecast["forecast_mid_season_fill_percent"], organization.paddy_area_ha)
    return forecast, plan


def message_tank_name(tank):
    if tank.local_name:
        return tank.local_name
    if tank.nearest_village and tank.nearest_village != "Unknown":
        return f"near {tank.nearest_village}"
    return None


def message_for_language(language, season_label, organization, plan_row):
    return render_plan_message(
        language=language,
        season_label=season_label,
        organization_name=organization.name,
        tank_name=message_tank_name(organization.tank),
        forecast_fill=plan_row.forecast_fill,
        risk=plan_row.risk_level,
        safe_area=plan_row.safe_area_ha,
        paddy_area=organization.paddy_area_ha,
        crop_advice=plan_row.crop_advice,
        bethma=plan_row.bethma,
    )


def existing_plan(db, organization_id, season_label):
    return (
        db.query(SeasonPlan)
        .filter(SeasonPlan.organization_id == organization_id, SeasonPlan.season == season_label)
        .first()
    )


def fill_plan_row(plan_row, forecast, plan, language):
    plan_row.forecast_fill = forecast["forecast_mid_season_fill_percent"] or 0
    plan_row.risk_level = forecast["risk_level"]
    plan_row.percent_to_cultivate = plan["percent_to_cultivate"]
    plan_row.safe_area_ha = plan["safe_area_ha"]
    plan_row.crop_advice = plan["crop_advice"]
    plan_row.bethma = plan["bethma"]
    plan_row.message_language = language
    plan_row.status = "draft"
    plan_row.created_at = datetime.utcnow()


def generate_plan_for_organization(db, organization, season_key, season_label):
    plan_row = existing_plan(db, organization.id, season_label)
    if plan_row and plan_row.status in LOCKED_STATUSES:
        return "skipped"
    result = "updated" if plan_row else "created"
    if plan_row is None:
        plan_row = SeasonPlan(organization_id=organization.id, season=season_label)
        db.add(plan_row)
    forecast, plan = plan_inputs(db, organization, season_key)
    contact = primary_contact(organization)
    language = supported_language(contact.language if contact else "en")
    fill_plan_row(plan_row, forecast, plan, language)
    plan_row.message_text = message_for_language(language, season_label, organization, plan_row)
    return result


def message_payload(message):
    return {
        "id": message.id,
        "contact_id": message.contact_id,
        "contact_name": message.contact.name if message.contact else None,
        "direction": message.direction,
        "channel": message.channel,
        "text": message.text,
        "status": message.status,
        "provider_message_id": message.provider_message_id,
        "created_at": message.created_at.isoformat(),
    }


def contact_brief(contact):
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "language": contact.language,
        "channel": contact.channel,
        "opted_in": contact.opted_in,
    }


def contact_previews(db, plan_row):
    return [
        {
            "contact_id": contact.id,
            "contact_name": contact.name,
            "phone": contact.phone,
            "language": contact.language,
            "channel": contact.channel,
            "opted_in": contact.opted_in,
            "uses_edited_text": contact.language == plan_row.message_language,
            "text": text_for_contact(db, plan_row, contact),
        }
        for contact in plan_row.organization.contacts
    ]


def plan_payload(db, plan_row):
    organization = plan_row.organization
    contact = primary_contact(organization)
    return {
        "id": plan_row.id,
        "organization_id": organization.id,
        "organization_name": organization.name,
        "tank_id": organization.tank_id,
        "tank_name": tank_display_name(organization.tank),
        "paddy_area_ha": organization.paddy_area_ha,
        "season": plan_row.season,
        "forecast_fill": plan_row.forecast_fill,
        "risk_level": plan_row.risk_level,
        "percent_to_cultivate": plan_row.percent_to_cultivate,
        "safe_area_ha": plan_row.safe_area_ha,
        "crop_advice": plan_row.crop_advice,
        "bethma": plan_row.bethma,
        "message_language": plan_row.message_language,
        "message_text": plan_row.message_text,
        "status": plan_row.status,
        "is_sending": is_sending(plan_row),
        "channel": contact.channel if contact else None,
        "contacts": [contact_brief(item) for item in organization.contacts],
        "previews": contact_previews(db, plan_row),
        "messages": [message_payload(message) for message in plan_row.messages if message.direction == "outbound"],
        "created_at": plan_row.created_at.isoformat(),
        "sent_at": plan_row.sent_at.isoformat() if plan_row.sent_at else None,
    }


def get_plan_or_404(db, plan_id):
    plan_row = db.get(SeasonPlan, plan_id)
    if plan_row is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan_row


def text_for_contact(db, plan_row, contact):
    if contact.language == plan_row.message_language:
        return plan_row.message_text
    return message_for_language(contact.language, plan_row.season, plan_row.organization, plan_row)


def send_to_contact(db, plan_row, contact):
    text = text_for_contact(db, plan_row, contact)
    result = choose_provider(contact.channel).send_message(contact.phone, text, contact.channel)
    db.add(
        Message(
            contact_id=contact.id,
            plan_id=plan_row.id,
            direction="outbound",
            channel=contact.channel,
            text=text,
            status=result["status"],
            provider_message_id=result["provider_message_id"],
        )
    )
    return result["status"]


def is_sending(plan_row):
    return plan_row.status == "approved" and plan_row.sent_at is not None


def overall_status(statuses):
    if not statuses or "failed" in statuses:
        return "failed"
    if "queued" in statuses:
        return "approved"
    return "sent"


def send_plan(db, plan_row):
    if plan_row.status not in SENDABLE_STATUSES:
        raise HTTPException(status_code=400, detail="The plan must be approved by the officer before sending")
    if is_sending(plan_row):
        raise HTTPException(status_code=400, detail="This plan is already being sent")
    recipients = [contact for contact in plan_row.organization.contacts if contact.opted_in]
    statuses = [send_to_contact(db, plan_row, contact) for contact in recipients]
    plan_row.status = overall_status(statuses)
    plan_row.sent_at = datetime.utcnow()


@router.post("/generate")
def generate_plans(season: str = Query("current"), db: Session = Depends(get_db)):
    season_label = season_label_for_key(season)
    results = {"created": 0, "updated": 0, "skipped": 0}
    for organization in db.query(FarmerOrganization).all():
        results[generate_plan_for_organization(db, organization, season, season_label)] += 1
    db.commit()
    return {"season": season_label, **results}


@router.get("")
def list_plans(season: str = Query("current"), db: Session = Depends(get_db)):
    season_label = season_label_for_key(season)
    plans = db.query(SeasonPlan).filter(SeasonPlan.season == season_label).order_by(SeasonPlan.id).all()
    return {"season": season_label, "plans": [plan_payload(db, plan_row) for plan_row in plans]}


@router.post("/send-approved")
def send_approved_plans(season: str = Query("current"), db: Session = Depends(get_db)):
    season_label = season_label_for_key(season)
    plans = db.query(SeasonPlan).filter(SeasonPlan.season == season_label, SeasonPlan.status == "approved").all()
    plans = [plan_row for plan_row in plans if not is_sending(plan_row)]
    for plan_row in plans:
        send_plan(db, plan_row)
    db.commit()
    return {"season": season_label, "sent": len(plans)}


@router.put("/{plan_id}")
def update_plan_text(plan_id: int, data: PlanTextInput, db: Session = Depends(get_db)):
    plan_row = get_plan_or_404(db, plan_id)
    if plan_row.status == "sent":
        raise HTTPException(status_code=400, detail="A sent plan cannot be edited")
    plan_row.message_text = data.message_text.strip()
    db.commit()
    return plan_payload(db, plan_row)


@router.post("/{plan_id}/approve")
def approve_plan(plan_id: int, db: Session = Depends(get_db)):
    plan_row = get_plan_or_404(db, plan_id)
    if plan_row.status == "sent":
        raise HTTPException(status_code=400, detail="Plan was already sent")
    plan_row.status = "approved"
    plan_row.sent_at = None
    db.commit()
    return plan_payload(db, plan_row)


@router.post("/{plan_id}/send")
def send_single_plan(plan_id: int, db: Session = Depends(get_db)):
    plan_row = get_plan_or_404(db, plan_id)
    send_plan(db, plan_row)
    db.commit()
    db.refresh(plan_row)
    return plan_payload(db, plan_row)


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan_row = get_plan_or_404(db, plan_id)
    if is_sending(plan_row):
        raise HTTPException(status_code=400, detail="This plan is still being sent")
    db.query(Message).filter(Message.plan_id == plan_id).update({Message.plan_id: None}, synchronize_session=False)
    db.delete(plan_row)
    db.commit()
    return {"deleted": plan_id}
