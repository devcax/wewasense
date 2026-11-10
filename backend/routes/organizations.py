import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database import get_db
import config
from models import Contact, FarmerOrganization, Message, Tank
from routes.tanks import tank_display_name

router = APIRouter(prefix="/organizations", tags=["organizations"])

SRI_LANKA_PHONE_PATTERN = re.compile(r"^\+94\d{9}$")


def normalize_phone(phone):
    cleaned = re.sub(r"[\s\-()]", "", phone)
    if cleaned.startswith("0") and len(cleaned) == 10:
        cleaned = "+94" + cleaned[1:]
    if cleaned.startswith("94") and len(cleaned) == 11:
        cleaned = "+" + cleaned
    return cleaned


class ContactInput(BaseModel):
    name: str = Field(min_length=1)
    phone: str
    language: str = Field(default="si", pattern="^(si|ta|en)$")
    channel: str = Field(default="sms", pattern="^(sms|whatsapp)$")
    opted_in: bool = False

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        phone = normalize_phone(value)
        if not SRI_LANKA_PHONE_PATTERN.match(phone):
            raise ValueError("Phone must be a Sri Lankan number like +94771234567")
        return phone


class OrganizationInput(BaseModel):
    name: str = Field(min_length=1)
    agrarian_service_centre: str = Field(min_length=1)
    tank_id: str
    paddy_area_ha: float = Field(gt=0)
    tank_local_name: str | None = None
    contacts: list[ContactInput] = Field(min_length=1)

    @field_validator("contacts")
    @classmethod
    def require_consent(cls, contacts):
        if not any(contact.opted_in for contact in contacts):
            raise ValueError("At least one contact must give consent to receive messages")
        return contacts


def contact_payload(contact):
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "language": contact.language,
        "channel": contact.channel,
        "opted_in": contact.opted_in,
    }


def organization_payload(organization):
    return {
        "id": organization.id,
        "name": organization.name,
        "agrarian_service_centre": organization.agrarian_service_centre,
        "tank_id": organization.tank_id,
        "tank_name": tank_display_name(organization.tank),
        "paddy_area_ha": organization.paddy_area_ha,
        "created_at": organization.created_at.isoformat(),
        "contacts": [contact_payload(contact) for contact in organization.contacts],
    }


def get_organization_or_404(db, organization_id):
    organization = db.get(FarmerOrganization, organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


def get_tank_or_400(db, tank_id):
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise HTTPException(status_code=400, detail="Selected tank does not exist")
    return tank


def apply_tank_local_name(tank, local_name):
    if local_name and local_name.strip() and not tank.local_name:
        tank.local_name = local_name.strip()


def build_contacts(contact_inputs):
    return [Contact(**contact.model_dump()) for contact in contact_inputs]


def validate_contact_channels(contacts):
    available = {"sms": config.has_twilio_keys(), "whatsapp": config.has_whatsapp_keys()}
    labels = {"sms": "SMS (Twilio)", "whatsapp": "WhatsApp"}
    unavailable = sorted({labels[contact.channel] for contact in contacts if not available[contact.channel]})
    if unavailable:
        raise HTTPException(status_code=400, detail=f"Messaging channel not configured: {', '.join(unavailable)}. Configure it in backend/.env and restart the backend.")


def apply_organization_fields(organization, data):
    organization.name = data.name.strip()
    organization.agrarian_service_centre = data.agrarian_service_centre.strip()
    organization.tank_id = data.tank_id
    organization.paddy_area_ha = data.paddy_area_ha


def detach_contact_messages(db, organization):
    contact_ids = [contact.id for contact in organization.contacts]
    if contact_ids:
        db.query(Message).filter(Message.contact_id.in_(contact_ids)).update(
            {Message.contact_id: None}, synchronize_session=False
        )


def detach_plan_messages(db, organization):
    plan_ids = [plan.id for plan in organization.plans]
    if plan_ids:
        db.query(Message).filter(Message.plan_id.in_(plan_ids)).update(
            {Message.plan_id: None}, synchronize_session=False
        )


@router.get("")
def list_organizations(tank_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(FarmerOrganization)
    if tank_id:
        query = query.filter(FarmerOrganization.tank_id == tank_id)
    return [organization_payload(organization) for organization in query.order_by(FarmerOrganization.name).all()]


@router.get("/{organization_id}")
def get_organization(organization_id: int, db: Session = Depends(get_db)):
    return organization_payload(get_organization_or_404(db, organization_id))


@router.post("", status_code=201)
def create_organization(data: OrganizationInput, db: Session = Depends(get_db)):
    validate_contact_channels(data.contacts)
    tank = get_tank_or_400(db, data.tank_id)
    apply_tank_local_name(tank, data.tank_local_name)
    organization = FarmerOrganization()
    apply_organization_fields(organization, data)
    organization.contacts = build_contacts(data.contacts)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization_payload(organization)


@router.put("/{organization_id}")
def update_organization(organization_id: int, data: OrganizationInput, db: Session = Depends(get_db)):
    organization = get_organization_or_404(db, organization_id)
    validate_contact_channels(data.contacts)
    tank = get_tank_or_400(db, data.tank_id)
    apply_tank_local_name(tank, data.tank_local_name)
    apply_organization_fields(organization, data)
    detach_contact_messages(db, organization)
    organization.contacts = build_contacts(data.contacts)
    db.commit()
    db.refresh(organization)
    return organization_payload(organization)


@router.delete("/{organization_id}")
def delete_organization(organization_id: int, db: Session = Depends(get_db)):
    organization = get_organization_or_404(db, organization_id)
    detach_contact_messages(db, organization)
    detach_plan_messages(db, organization)
    db.delete(organization)
    db.commit()
    return {"deleted": organization_id}
