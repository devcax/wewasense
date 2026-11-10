from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utc_now():
    return datetime.utcnow()


class Tank(Base):
    __tablename__ = "tanks"

    tank_id: Mapped[str] = mapped_column(String, primary_key=True)
    local_name: Mapped[str | None] = mapped_column(String, nullable=True)
    nearest_village: Mapped[str] = mapped_column(String)
    area_ha: Mapped[float] = mapped_column(Float)
    center_lat: Mapped[float] = mapped_column(Float)
    center_lon: Mapped[float] = mapped_column(Float)
    size_class: Mapped[str] = mapped_column(String)

    organizations: Mapped[list["FarmerOrganization"]] = relationship(back_populates="tank")


class WaterReading(Base):
    __tablename__ = "water_readings"
    __table_args__ = (Index("ix_water_readings_tank_date", "tank_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tank_id: Mapped[str] = mapped_column(ForeignKey("tanks.tank_id"))
    date: Mapped[date] = mapped_column(Date)
    fill_percent: Mapped[float] = mapped_column(Float)
    normal_percent: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String)


class FarmerOrganization(Base):
    __tablename__ = "farmer_organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    tank_id: Mapped[str] = mapped_column(ForeignKey("tanks.tank_id"))
    paddy_area_ha: Mapped[float] = mapped_column(Float)
    agrarian_service_centre: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    tank: Mapped[Tank] = relationship(back_populates="organizations")
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan", order_by="Contact.id"
    )
    plans: Mapped[list["SeasonPlan"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("farmer_organizations.id"))
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    language: Mapped[str] = mapped_column(String, default="si")
    channel: Mapped[str] = mapped_column(String, default="sms")
    opted_in: Mapped[bool] = mapped_column(Boolean, default=True)

    organization: Mapped[FarmerOrganization] = relationship(back_populates="contacts")


class SeasonPlan(Base):
    __tablename__ = "season_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("farmer_organizations.id"))
    season: Mapped[str] = mapped_column(String)
    forecast_fill: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String)
    percent_to_cultivate: Mapped[float] = mapped_column(Float)
    safe_area_ha: Mapped[float] = mapped_column(Float, default=0)
    crop_advice: Mapped[str] = mapped_column(Text)
    bethma: Mapped[bool] = mapped_column(Boolean, default=False)
    message_language: Mapped[str] = mapped_column(String, default="en")
    message_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    organization: Mapped[FarmerOrganization] = relationship(back_populates="plans")
    messages: Mapped[list["Message"]] = relationship(back_populates="plan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("season_plans.id"), nullable=True)
    direction: Mapped[str] = mapped_column(String)
    channel: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String)
    provider_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    from_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    reply_code: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    contact: Mapped[Contact | None] = relationship()
    plan: Mapped[SeasonPlan | None] = relationship(back_populates="messages")


class TankForecast(Base):
    __tablename__ = "tank_forecasts"
    __table_args__ = (Index("ix_tank_forecasts_season_tank", "season_key", "tank_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_key: Mapped[str] = mapped_column(String)
    input_season_label: Mapped[str] = mapped_column(String)
    tank_id: Mapped[str] = mapped_column(ForeignKey("tanks.tank_id"))
    planting_date: Mapped[date] = mapped_column(Date)
    fill_at_planting: Mapped[float] = mapped_column(Float)
    rain_30d: Mapped[float] = mapped_column(Float)
    rain_60d: Mapped[float] = mapped_column(Float)
    forecast_fill: Mapped[float] = mapped_column(Float)
    normal_fill: Mapped[float] = mapped_column(Float)
    percent_of_normal: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str] = mapped_column(String)
    model_version: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)