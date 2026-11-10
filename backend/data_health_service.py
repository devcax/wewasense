import os
from datetime import date
from functools import lru_cache

import numpy as np
import pandas as pd
from sqlalchemy import func

from compute_forecasts import fill_near_date, planting_date_for, rain_csv_path, split_label
from database import engine
from models import TankForecast, WaterReading
from prediction_service import (
    assets,
    get_normal,
    get_pre_season_forecasts,
    mid_growth_months,
    planting_months,
)

training_end_date = date(2023, 1, 31)
water_interval_days = 12
season_interval_days = 183
psi_bin_count = 10
psi_floor = 0.0001

drift_features = {
    "rain_30d": "Rain 30 days before planting (mm)",
    "rain_60d": "Rain 60 days before planting (mm)",
    "fill_at_planting": "Fill at planting (%)",
    "planting_difference": "Fill compared with normal at planting (points)",
}


def freshness_status(last_update, expected_interval_days, today):
    if last_update is None:
        return "missing", None
    age_days = (today - last_update).days
    if age_days <= expected_interval_days:
        return "fresh", age_days
    if age_days <= expected_interval_days * 3:
        return "late", age_days
    return "missing", age_days


def source_payload(name, description, detail, last_update, expected_interval_days, today):
    status, age_days = freshness_status(last_update, expected_interval_days, today)
    return {
        "name": name,
        "description": description,
        "detail": detail,
        "last_update": last_update.isoformat() if last_update else None,
        "expected_interval_days": expected_interval_days,
        "age_days": age_days,
        "status": status,
    }


def water_level_source(db, today):
    latest_date = db.query(func.max(WaterReading.date)).scalar()
    tanks = db.query(func.count(func.distinct(WaterReading.tank_id))).filter(WaterReading.date == latest_date).scalar() or 0
    detail = f"{tanks} tanks read on the latest date" if latest_date else "No readings loaded"
    return source_payload(
        "Tank water levels", "Sentinel-1 water extent (water_clean.csv)", detail,
        latest_date, water_interval_days, today,
    )


def season_sort_key(label):
    season_type, year = split_label(label)
    return year, 0 if season_type == "Yala" else 1


def latest_rain_season():
    labels = pd.read_csv(rain_csv_path, usecols=["season_label"])["season_label"].unique()
    return max(labels, key=season_sort_key) if len(labels) else None


def rain_source(today):
    label = latest_rain_season()
    if label is None:
        return source_payload("Rainfall features", "GPM rain before planting (rain_features.csv)", "No rain data", None, season_interval_days, today)
    planting_date = planting_date_for(*split_label(label))
    return source_payload(
        "Rainfall features", "GPM rain before planting (rain_features.csv)",
        f"Latest season {label}, rain up to planting on {planting_date.isoformat()}",
        planting_date, season_interval_days, today,
    )


def forecast_source(db, today):
    latest = db.query(TankForecast).order_by(TankForecast.created_at.desc()).first()
    if latest is None:
        return source_payload("Season forecasts", "Stored model forecasts (compute_forecasts.py)", "No forecasts computed", None, season_interval_days, today)
    count = db.query(func.count(TankForecast.id)).filter(TankForecast.season_key == latest.season_key).scalar()
    return source_payload(
        "Season forecasts", "Stored model forecasts (compute_forecasts.py)",
        f"{count} tanks using inputs from {latest.input_season_label}",
        latest.created_at.date(), season_interval_days, today,
    )


def data_sources(db, today):
    return [water_level_source(db, today), rain_source(today), forecast_source(db, today)]


def data_version():
    with engine.connect() as connection:
        latest, count = connection.exec_driver_sql("select max(date), count(*) from water_readings").one()
    return latest, count, os.path.getmtime(rain_csv_path)


def load_readings():
    return pd.read_sql("select tank_id, date, fill_percent from water_readings", engine, parse_dates=["date"])


def mid_growth_period(season_type, year):
    month = mid_growth_months[season_type]
    return (year + 1 if season_type == "Maha" else year), month


def actual_mid_growth_fill(readings, season_type, year):
    mid_year, mid_month = mid_growth_period(season_type, year)
    in_month = readings[(readings["date"].dt.year == mid_year) & (readings["date"].dt.month == mid_month)]
    return in_month.groupby("tank_id")["fill_percent"].mean()


def normals_for(tank_ids, month):
    return pd.Series([get_normal(tank_id, month) for tank_id in tank_ids], index=tank_ids, dtype=float)


def inputs_for_season(label, rain_rows, readings, profiles):
    season_type, year = split_label(label)
    planting_date = planting_date_for(season_type, year)
    frame = rain_rows.set_index("tank_id")[["rain_30d", "rain_60d"]]
    frame = frame.join(fill_near_date(readings, planting_date).rename("fill_at_planting"), how="inner")
    frame = frame.join(profiles[["area_ha", "fill_variation", "dry_share"]], how="inner")
    frame["normal_at_planting"] = normals_for(frame.index, planting_months[season_type])
    frame["normal_at_mid_growth"] = normals_for(frame.index, mid_growth_months[season_type])
    frame = frame.dropna()
    frame["planting_difference"] = frame["fill_at_planting"] - frame["normal_at_planting"]
    frame["is_maha"] = 1 if season_type == "Maha" else 0
    frame["actual_mid_growth_fill"] = actual_mid_growth_fill(readings, season_type, year)
    frame["season_label"] = label
    frame["season_type"] = season_type
    frame["is_training"] = planting_date <= training_end_date
    return frame.reset_index()


@lru_cache(maxsize=2)
def season_inputs(version):
    readings = load_readings()
    rain = pd.read_csv(rain_csv_path)
    profiles = assets["profiles"]
    frames = [inputs_for_season(label, rows, readings, profiles) for label, rows in rain.groupby("season_label")]
    frames = [frame for frame in frames if not frame.empty]
    inputs = pd.concat(frames, ignore_index=True)
    inputs["forecast_fill"] = get_pre_season_forecasts(inputs)
    return inputs


def current_season_inputs():
    return season_inputs(data_version())


def population_stability_index(reference, current):
    edges = np.unique(np.quantile(reference, np.linspace(0, 1, psi_bin_count + 1)))
    edges[0], edges[-1] = -np.inf, np.inf
    reference_share = np.clip(np.histogram(reference, edges)[0] / len(reference), psi_floor, None)
    current_share = np.clip(np.histogram(current, edges)[0] / len(current), psi_floor, None)
    return float(np.sum((current_share - reference_share) * np.log(current_share / reference_share)))


def training_reference(inputs, season_type):
    return inputs[inputs["is_training"] & (inputs["season_type"] == season_type)]


def training_season_psi(reference, feature_name):
    values = []
    for label in reference["season_label"].unique():
        others = reference[reference["season_label"] != label][feature_name].to_numpy()
        season = reference[reference["season_label"] == label][feature_name].to_numpy()
        values.append(population_stability_index(others, season))
    return float(np.median(values)), float(np.max(values))


@lru_cache(maxsize=2)
def training_thresholds(version):
    inputs = season_inputs(version)
    thresholds = {}
    for season_type in inputs["season_type"].unique():
        reference = training_reference(inputs, season_type)
        for feature_name in drift_features:
            thresholds[season_type, feature_name] = training_season_psi(reference, feature_name)
    return thresholds


def drift_status(psi_value, typical_psi, largest_psi):
    if psi_value <= typical_psi:
        return "ok"
    if psi_value <= largest_psi:
        return "warning"
    return "alert"


def feature_drift(reference, current, feature_name, thresholds):
    psi_value = population_stability_index(reference[feature_name].to_numpy(), current[feature_name].to_numpy())
    typical_psi, largest_psi = thresholds[current["season_type"].iloc[0], feature_name]
    return {
        "feature_name": feature_name,
        "feature_label": drift_features[feature_name],
        "training_mean": round(float(reference[feature_name].mean()), 1),
        "current_mean": round(float(current[feature_name].mean()), 1),
        "psi_value": round(psi_value, 2),
        "typical_training_psi": round(typical_psi, 2),
        "largest_training_psi": round(largest_psi, 2),
        "drift_score": round(psi_value / largest_psi, 2) if largest_psi > 0 else 0.0,
        "status": drift_status(psi_value, typical_psi, largest_psi),
    }


def ordered_seasons(inputs, only_new):
    frame = inputs[~inputs["is_training"]] if only_new else inputs
    return sorted(frame["season_label"].unique(), key=season_sort_key)


def season_drift(inputs, thresholds, label):
    current = inputs[inputs["season_label"] == label]
    reference = training_reference(inputs, current["season_type"].iloc[0])
    return [feature_drift(reference, current, name, thresholds) for name in drift_features], len(current)


def training_range_label(inputs, season_type):
    labels = sorted(training_reference(inputs, season_type)["season_label"].unique(), key=season_sort_key)
    return f"{labels[0]} to {labels[-1]}" if labels else None


def drift_report():
    version = data_version()
    inputs = season_inputs(version)
    thresholds = training_thresholds(version)
    new_seasons = ordered_seasons(inputs, only_new=True)
    if not new_seasons:
        return {"latest_season": None, "features": [], "history": [], "tanks": 0, "reference": None}
    latest = new_seasons[-1]
    features, tanks = season_drift(inputs, thresholds, latest)
    history = []
    for label in new_seasons:
        point = {"season": label}
        for item in season_drift(inputs, thresholds, label)[0]:
            point[item["feature_name"]] = item["drift_score"]
        history.append(point)
    latest_type = split_label(latest)[0]
    return {
        "latest_season": latest,
        "reference": f"{latest_type} training seasons ({training_range_label(inputs, latest_type)})",
        "tanks": tanks,
        "features": features,
        "history": history,
    }


def season_performance(season_rows):
    evaluated = season_rows.dropna(subset=["actual_mid_growth_fill"])
    if evaluated.empty:
        return None
    errors = (evaluated["forecast_fill"] - evaluated["actual_mid_growth_fill"]).abs()
    return {
        "season": evaluated["season_label"].iloc[0],
        "average_forecast_fill": round(float(evaluated["forecast_fill"].mean()), 1),
        "average_actual_fill": round(float(evaluated["actual_mid_growth_fill"].mean()), 1),
        "mean_absolute_error": round(float(errors.mean()), 1),
        "tanks_evaluated": int(len(evaluated)),
    }


def performance_report():
    inputs = current_season_inputs()
    seasons = []
    for label in ordered_seasons(inputs, only_new=True):
        result = season_performance(inputs[inputs["season_label"] == label])
        if result:
            seasons.append(result)
    evaluated = inputs[~inputs["is_training"]].dropna(subset=["actual_mid_growth_fill"])
    overall = (evaluated["forecast_fill"] - evaluated["actual_mid_growth_fill"]).abs().mean() if len(evaluated) else None
    return {
        "training_end_date": training_end_date.isoformat(),
        "seasons": seasons,
        "overall_mean_absolute_error": round(float(overall), 1) if overall is not None else None,
    }

