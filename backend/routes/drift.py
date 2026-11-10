from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import MODEL_VERSION
from data_health_service import data_sources, drift_features, drift_report, performance_report
from database import get_db
from models import Tank, WaterReading

router = APIRouter(tags=["drift"])

COVERAGE_WINDOW_DAYS = 30
SOURCE_LABELS = {"sentinel1": "Sentinel-1", "sentinel2": "Sentinel-2"}
SIZE_CLASS_LABELS = {"small_medium": "Small and medium", "small": "Small", "medium": "Medium", "large": "Large"}


def tanks_with_reading_since(db, since):
    return db.query(func.count(func.distinct(WaterReading.tank_id))).filter(WaterReading.date >= since).scalar() or 0


def coverage_by_source(db, since):
    rows = (
        db.query(WaterReading.source, func.count(func.distinct(WaterReading.tank_id)))
        .filter(WaterReading.date >= since)
        .group_by(WaterReading.source)
        .order_by(WaterReading.source)
        .all()
    )
    return [{"source": SOURCE_LABELS.get(source, source), "tanks": count} for source, count in rows]


def coverage_by_size_class(db, since):
    rows = []
    for (size_class,) in db.query(Tank.size_class).distinct().order_by(Tank.size_class):
        total = db.query(func.count(Tank.tank_id)).filter(Tank.size_class == size_class).scalar() or 0
        covered = (
            db.query(func.count(func.distinct(WaterReading.tank_id)))
            .join(Tank, Tank.tank_id == WaterReading.tank_id)
            .filter(WaterReading.date >= since, Tank.size_class == size_class)
            .scalar()
            or 0
        )
        label = SIZE_CLASS_LABELS.get(size_class, size_class)
        rows.append({"size_class": label, "total": total, "with_reading": covered, "without_reading": total - covered})
    return rows


def satellite_coverage(db, today):
    since = today - timedelta(days=COVERAGE_WINDOW_DAYS)
    total = db.query(func.count(Tank.tank_id)).scalar() or 0
    covered = tanks_with_reading_since(db, since)
    return {
        "window_days": COVERAGE_WINDOW_DAYS,
        "total_tanks": total,
        "by_source": coverage_by_source(db, since) + [{"source": "No valid reading", "tanks": total - covered}],
        "by_size_class": coverage_by_size_class(db, since),
    }


@router.get("/data-health")
def data_health(db: Session = Depends(get_db)):
    today = date.today()
    return {
        "model_version": MODEL_VERSION,
        "sources": data_sources(db, today),
        "coverage": satellite_coverage(db, today),
    }


@router.get("/drift")
def drift():
    return {
        "model_version": MODEL_VERSION,
        "beyond_training_score": 1,
        "feature_labels": drift_features,
        **drift_report(),
    }


@router.get("/model-performance")
def model_performance():
    return {"model_version": MODEL_VERSION, **performance_report()}
