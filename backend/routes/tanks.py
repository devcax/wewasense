from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import FarmerOrganization, Tank, TankForecast, WaterReading
from plan_service import build_plan_for_tank
from prediction_service import get_normal, get_pre_season_forecast, get_update_forecast, choose_risk_level
from seasons import resolve_season, season_options

router = APIRouter(tags=["tanks"])

RISK_LEVELS = ("HIGH", "MEDIUM", "LOW")


def tank_display_name(tank):
    if tank.local_name:
        return tank.local_name
    return tank.tank_id if tank.nearest_village == "Unknown" else f"Unnamed tank near {tank.nearest_village}"


def risk_level_for(fill, normal):
    return choose_risk_level(fill, normal, 0.80) if normal and fill is not None else None


def load_forecasts(db, season):
    season_key = resolve_season(season)["key"]
    rows = db.query(TankForecast).filter(TankForecast.season_key == season_key).all()
    return {row.tank_id: row for row in rows}


def forecast_not_available(tank, season):
    info = resolve_season(season)
    reason = "too_small" if tank.area_ha < 5 else "no_inputs"
    return {
        "forecast_mid_season_fill_percent": None,
        "normal_mid_season_fill_percent": get_normal(tank.tank_id, info["mid"].month),
        "risk_level": None,
        "confidence": None,
        "model_version": "pre-season-v1",
        "forecast_status": reason,
        "forecast_inputs_label": None,
    }


def forecast_from_row(tank, season, row):
    if row is None:
        return forecast_not_available(tank, season)
    return {
        "forecast_mid_season_fill_percent": round(row.forecast_fill, 1),
        "normal_mid_season_fill_percent": round(row.normal_fill, 1),
        "risk_level": row.risk_level,
        "confidence": "medium",
        "model_version": row.model_version,
        "forecast_status": "demo" if row.is_demo else "ok",
        "forecast_inputs_label": row.input_season_label,
    }


def signals_from_row(row):
    if row is None:
        return None
    return {
        "inputs_from_season": row.input_season_label,
        "planting_date": row.planting_date.isoformat(),
        "fill_at_planting_percent": round(row.fill_at_planting, 1),
        "rain_30d_mm": round(row.rain_30d),
        "rain_60d_mm": round(row.rain_60d),
        "is_demo": row.is_demo,
    }


class ForecastInput(BaseModel):
    season: str = Field(pattern="^(current|future)$")
    fill_at_planting: float = Field(ge=0, le=100, allow_inf_nan=False)
    rain_60d: float = Field(ge=0, allow_inf_nan=False)
    rain_30d: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    fill_at_update: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    rain_after_30d: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_inputs(self):
        if self.fill_at_update is None and self.rain_30d is None:
            raise ValueError("rain_30d is required for a pre-season forecast")
        if self.fill_at_update is not None and self.rain_after_30d is None:
            raise ValueError("rain_after_30d is required for an update forecast")
        return self


def latest_readings_by_tank(db):
    latest_dates = (
        db.query(WaterReading.tank_id, func.max(WaterReading.date).label("latest_date"))
        .group_by(WaterReading.tank_id)
        .subquery()
    )
    readings = (
        db.query(WaterReading)
        .join(
            latest_dates,
            (WaterReading.tank_id == latest_dates.c.tank_id) & (WaterReading.date == latest_dates.c.latest_date),
        )
        .all()
    )
    return {reading.tank_id: reading for reading in readings}


def latest_reading_for_tank(db, tank_id):
    return (
        db.query(WaterReading)
        .filter(WaterReading.tank_id == tank_id)
        .order_by(WaterReading.date.desc())
        .first()
    )


def organization_counts_by_tank(db):
    rows = db.query(FarmerOrganization.tank_id, func.count(FarmerOrganization.id)).group_by(FarmerOrganization.tank_id)
    return {tank_id: count for tank_id, count in rows}


def current_status(reading):
    if reading is None:
        return {
            "current_fill_percent": None,
            "current_normal_percent": None,
            "current_risk_level": None,
            "last_reading_date": None,
            "last_reading_source": None,
        }
    return {
        "current_fill_percent": reading.fill_percent,
        "current_normal_percent": reading.normal_percent,
        "current_risk_level": risk_level_for(reading.fill_percent, reading.normal_percent),
        "last_reading_date": reading.date.isoformat(),
        "last_reading_source": reading.source,
    }


def displayed_values(status, forecast, view):
    if view == "forecast":
        return forecast["forecast_mid_season_fill_percent"], forecast["normal_mid_season_fill_percent"], forecast["risk_level"]
    return status["current_fill_percent"], status["current_normal_percent"], status["current_risk_level"]


def tank_basics(tank):
    return {
        "tank_id": tank.tank_id,
        "name": tank_display_name(tank),
        "local_name": tank.local_name,
        "nearest_village": tank.nearest_village,
        "area_ha": tank.area_ha,
        "center_lat": tank.center_lat,
        "center_lon": tank.center_lon,
        "size_class": tank.size_class,
    }


def tank_summary(tank, reading, season, view, organization_count=0, forecast_row=None):
    status = current_status(reading)
    forecast = forecast_from_row(tank, season, forecast_row)
    display_fill, display_normal, display_risk = displayed_values(status, forecast, view)
    return {
        **tank_basics(tank),
        **status,
        **forecast,
        "display_fill_percent": display_fill,
        "display_normal_percent": display_normal,
        "display_risk_level": display_risk,
        "organization_count": organization_count,
    }


def all_tank_summaries(db, season, view):
    readings = latest_readings_by_tank(db)
    counts = organization_counts_by_tank(db)
    forecasts = load_forecasts(db, season)
    return [
        tank_summary(tank, readings.get(tank.tank_id), season, view, counts.get(tank.tank_id, 0), forecasts.get(tank.tank_id))
        for tank in db.query(Tank).order_by(Tank.tank_id).all()
    ]


def average(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 1) if values else None


def build_summary(tank_rows):
    counts = {level: 0 for level in RISK_LEVELS}
    for row in tank_rows:
        if row["display_risk_level"] in counts:
            counts[row["display_risk_level"]] += 1
    return {
        "total_tanks": len(tank_rows),
        "risk_counts": counts,
        "average_fill_percent": average([row["display_fill_percent"] for row in tank_rows]),
        "average_normal_percent": average([row["display_normal_percent"] for row in tank_rows]),
        "large_reservoirs": sum(1 for row in tank_rows if row["size_class"] == "large"),
    }


def forecast_count(db, season_key):
    return db.query(func.count(TankForecast.id)).filter(TankForecast.season_key == season_key).scalar() or 0


def forecast_unavailable_reason(info):
    planting_month = info["start"].strftime("%B %Y")
    forecast_month = info["mid"].strftime("%B")
    return (
        f"The {forecast_month} water level forecast is based on each tank's water level at planting "
        f"and the rainfall in the 60 days before it. These observations for {planting_month} are not yet available. "
        f"The forecast will be published after planting begins in mid-{planting_month}."
    )


def season_payload(season, db):
    info = resolve_season(season)
    forecast_month = info["mid"].strftime("%B")
    forecast_available = forecast_count(db, info["key"]) > 0
    return {
        "key": info["key"],
        "label": info["label"],
        "mid": info["mid"].isoformat(),
        "forecast_month": forecast_month,
        "forecast_label": f"Forecast: {forecast_month} water",
        "current_label": "Water now",
        "forecast_available": forecast_available,
        "forecast_unavailable_reason": None if forecast_available else forecast_unavailable_reason(info),
    }


def get_tank_or_404(db, tank_id):
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise HTTPException(status_code=404, detail="Tank not found")
    return tank


def paddy_area_for_tank(tank):
    registered_area = sum(organization.paddy_area_ha for organization in tank.organizations)
    if registered_area > 0:
        return round(registered_area, 1), False
    return round(tank.area_ha * 1.2, 1), True


def tank_plan(tank, forecast):
    if forecast["forecast_mid_season_fill_percent"] is None:
        return None
    paddy_area, is_estimate = paddy_area_for_tank(tank)
    plan = build_plan_for_tank(tank.area_ha, forecast["forecast_mid_season_fill_percent"], paddy_area)
    return {**plan, "paddy_area_ha": paddy_area, "paddy_area_is_estimate": is_estimate}


def organization_brief(organization):
    return {
        "id": organization.id,
        "name": organization.name,
        "paddy_area_ha": organization.paddy_area_ha,
        "agrarian_service_centre": organization.agrarian_service_centre,
        "contact_count": len(organization.contacts),
    }


def parse_date_or_none(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}")


@router.get("/seasons")
def list_seasons():
    return season_options()


@router.get("/tanks")
def list_tanks(
    season: str = Query("current"),
    view: str = Query("current", pattern="^(current|forecast)$"),
    db: Session = Depends(get_db),
):
    return {"season": season_payload(season, db), "view": view, "tanks": all_tank_summaries(db, season, view)}


@router.get("/summary")
def summary(
    season: str = Query("current"),
    view: str = Query("forecast", pattern="^(current|forecast)$"),
    db: Session = Depends(get_db),
):
    return {"season": season_payload(season, db), "view": view, **build_summary(all_tank_summaries(db, season, view))}


@router.get("/tanks/{tank_id}")
def tank_details(tank_id: str, season: str = Query("current"), db: Session = Depends(get_db)):
    tank = get_tank_or_404(db, tank_id)
    forecast_row = load_forecasts(db, season).get(tank_id)
    summary_row = tank_summary(
        tank, latest_reading_for_tank(db, tank_id), season, "forecast",
        len(tank.organizations), forecast_row,
    )
    return {
        **summary_row,
        "season": season_payload(season, db),
        "google_maps_url": f"https://www.google.com/maps?q={tank.center_lat},{tank.center_lon}",
        "signals": signals_from_row(forecast_row),
        "plan": tank_plan(tank, summary_row),
        "organizations": [organization_brief(organization) for organization in tank.organizations],
    }


@router.post("/tanks/{tank_id}/forecast")
def forecast_tank(tank_id: str, data: ForecastInput, db: Session = Depends(get_db)):
    get_tank_or_404(db, tank_id)
    season = resolve_season(data.season)["type"].title()
    if data.fill_at_update is None:
        result = get_pre_season_forecast(tank_id, season, data.fill_at_planting, data.rain_30d, data.rain_60d)
    else:
        result = get_update_forecast(tank_id, season, data.fill_at_planting, data.fill_at_update, data.rain_60d, data.rain_after_30d)
    if result is None:
        raise HTTPException(status_code=422, detail="Model profile or monthly normals are unavailable for this tank")
    return result


@router.get("/tanks/{tank_id}/history")
def tank_history(tank_id: str, start: str | None = None, end: str | None = None, db: Session = Depends(get_db)):
    get_tank_or_404(db, tank_id)
    query = db.query(WaterReading).filter(WaterReading.tank_id == tank_id)
    start_date = parse_date_or_none(start)
    end_date = parse_date_or_none(end)
    if start_date:
        query = query.filter(WaterReading.date >= start_date)
    if end_date:
        query = query.filter(WaterReading.date <= end_date)
    return [
        {
            "date": reading.date.isoformat(),
            "fill_percent": reading.fill_percent,
            "normal_percent": reading.normal_percent,
            "source": reading.source,
        }
        for reading in query.order_by(WaterReading.date).all()
    ]
