import joblib
import pandas as pd
from pathlib import Path

model_folder = Path(__file__).resolve().parent / "model_files"
pre_season_alert_ratio = 0.80
update_alert_ratio = 0.70
medium_risk_ratio = 0.95
planting_months = {"Yala": 4, "Maha": 10}
mid_growth_months = {"Yala": 7, "Maha": 1}


def load_assets():
    return {
        "pre_season": joblib.load(f"{model_folder}/wewasense_model_v1.joblib"),
        "update": joblib.load(f"{model_folder}/wewasense_update_model_v1.joblib"),
        "profiles": pd.read_csv(f"{model_folder}/tank_profiles.csv").set_index("tank_id"),
        "normals": pd.read_csv(f"{model_folder}/tank_normals_train.csv"),
    }


assets = load_assets()
normal_lookup = {(row.tank_id, int(row.month)): float(row.normal_fill)
                 for row in assets["normals"].itertuples(index=False)}


def get_normal(tank_id, month):
    return normal_lookup.get((tank_id, month))


def get_profile(tank_id):
    if tank_id not in assets["profiles"].index:
        return None
    return assets["profiles"].loc[tank_id]


def build_base_features(tank_id, season, fill_at_planting):
    profile = get_profile(tank_id)
    normal_at_planting = get_normal(tank_id, planting_months[season])
    normal_at_mid_growth = get_normal(tank_id, mid_growth_months[season])
    if profile is None or normal_at_planting is None or normal_at_mid_growth is None:
        return None
    return {
        "planting_difference": fill_at_planting - normal_at_planting,
        "normal_at_planting": normal_at_planting,
        "normal_at_mid_growth": normal_at_mid_growth,
        "is_maha": 1 if season == "Maha" else 0,
        "area_ha": profile["area_ha"],
        "fill_variation": profile["fill_variation"],
        "dry_share": profile["dry_share"],
    }


def calculate_baseline(features):
    baseline = features["normal_at_mid_growth"] + features["planting_difference"]
    return min(max(baseline, 0), 100)


def run_model(model_bundle, features):
    feature_row = pd.DataFrame([{name: features[name] for name in model_bundle["features"]}])
    correction = float(model_bundle["model"].predict(feature_row)[0])
    return min(max(calculate_baseline(features) + correction, 0), 100)


def choose_risk_level(forecast_fill, normal_fill, high_ratio):
    if forecast_fill < normal_fill * high_ratio:
        return "HIGH"
    if forecast_fill < normal_fill * medium_risk_ratio:
        return "MEDIUM"
    return "LOW"


def build_result(forecast_fill, features, high_ratio, model_version):
    normal_fill = features["normal_at_mid_growth"]
    return {
        "forecast_mid_growth_fill_percent": round(forecast_fill, 1),
        "normal_mid_growth_fill_percent": round(normal_fill, 1),
        "percent_of_normal": round(forecast_fill / normal_fill * 100, 1) if normal_fill > 0 else None,
        "risk_level": choose_risk_level(forecast_fill, normal_fill, high_ratio),
        "model_version": model_version,
    }


def get_pre_season_forecast(tank_id, season, fill_at_planting, rain_30d, rain_60d):
    features = build_base_features(tank_id, season, fill_at_planting)
    if features is None:
        return None
    features["rain_30d"] = rain_30d
    features["rain_60d"] = rain_60d
    forecast_fill = run_model(assets["pre_season"], features)
    return build_result(forecast_fill, features, pre_season_alert_ratio, "pre-season-v1")


def get_pre_season_forecasts(frame):
    model_bundle = assets["pre_season"]
    baseline = (frame["normal_at_mid_growth"] + frame["planting_difference"]).clip(0, 100)
    correction = model_bundle["model"].predict(frame[model_bundle["features"]])
    return (baseline + correction).clip(0, 100)


def get_update_forecast(tank_id, season, fill_at_planting, fill_at_update, rain_60d, rain_after_30d):
    features = build_base_features(tank_id, season, fill_at_planting)
    if features is None:
        return None
    features["update_difference"] = fill_at_update - features["normal_at_planting"]
    features["rain_60d"] = rain_60d
    features["rain_after_30d"] = rain_after_30d
    forecast_fill = run_model(assets["update"], features)
    return build_result(forecast_fill, features, update_alert_ratio, "update-v1")
