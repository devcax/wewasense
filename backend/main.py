from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from database import create_tables, SessionLocal
from models import Tank
import csv
from messaging.providers import finish_stale_mock_messages, provider_summary
from routes import drift, messages, organizations, plans, tanks
from seasons import season_options

app = FastAPI(title="WewaSense API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()
with SessionLocal() as db:
    if not db.query(Tank).first():
        with (config.BACKEND_DIR / "model_files" / "tanks.csv").open(encoding="utf-8", newline="") as f:
            db.add_all([Tank(tank_id=row["tank_id"], area_ha=float(row["area_ha"]),
                             center_lat=float(row["center_lat"]), center_lon=float(row["center_lon"]),
                             size_class=row["size_class"], nearest_village="Unknown") for row in csv.DictReader(f)])
        db.commit()
finish_stale_mock_messages()

app.include_router(tanks.router)
app.include_router(organizations.router)
app.include_router(plans.router)
app.include_router(messages.router)
app.include_router(drift.router)


@app.get("/")
def health():
    return {"app": "WewaSense", "status": "ok"}


@app.get("/meta")
def meta():
    return {
        "model_version": config.MODEL_VERSION,
        "uses_mock_predictions": config.USES_MOCK_PREDICTIONS,
        "messaging_providers": provider_summary(),
        "seasons": season_options(),
    }
