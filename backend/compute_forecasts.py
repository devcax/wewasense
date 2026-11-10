from datetime import date, timedelta

import pandas as pd

from database import Base, SessionLocal, engine
from models import TankForecast
from prediction_service import get_pre_season_forecast
from seasons import resolve_season

rain_csv_path = "model_files/rain_features.csv"
search_window_days = 15
season_keys = ["current", "future"]


def planting_date_for(season_type, year):
    if season_type == "Maha":
        return date(year, 10, 15)
    return date(year, 4, 15)


def real_input_label(season_key):
    info = resolve_season(season_key)
    season_type = info["type"].title()
    mid_growth_date = info["mid"]
    year = mid_growth_date.year - 1 if season_type == "Maha" else mid_growth_date.year
    return f"{season_type} {year}"


def split_label(label):
    season_type, year = label.split()
    return season_type, int(year)


def load_readings():
    return pd.read_sql("select tank_id, date, fill_percent from water_readings", engine, parse_dates=["date"])


def fill_near_date(readings, target_date):
    target = pd.Timestamp(target_date)
    nearby = readings[(readings["date"] - target).abs() <= timedelta(days=search_window_days)].copy()
    if nearby.empty:
        return pd.Series(dtype=float)
    nearby["distance"] = (nearby["date"] - target).abs()
    nearest = nearby.loc[nearby.groupby("tank_id")["distance"].idxmin()]
    return nearest.set_index("tank_id")["fill_percent"]


def load_rain(label):
    rain = pd.read_csv(rain_csv_path)
    return rain[rain["season_label"] == label].set_index("tank_id")


def build_forecast_rows(season_key, readings):
    label = real_input_label(season_key)
    season_type, year = split_label(label)
    planting_date = planting_date_for(season_type, year)
    fills = fill_near_date(readings, planting_date)
    rain = load_rain(label)
    rows = []
    for tank_id in fills.index.intersection(rain.index):
        result = get_pre_season_forecast(
            tank_id, season_type, float(fills[tank_id]),
            float(rain.at[tank_id, "rain_30d"]), float(rain.at[tank_id, "rain_60d"]),
        )
        if result is None:
            continue
        rows.append(
            TankForecast(
                season_key=season_key,
                input_season_label=label,
                tank_id=tank_id,
                planting_date=planting_date,
                fill_at_planting=float(fills[tank_id]),
                rain_30d=float(rain.at[tank_id, "rain_30d"]),
                rain_60d=float(rain.at[tank_id, "rain_60d"]),
                forecast_fill=result["forecast_mid_growth_fill_percent"],
                normal_fill=result["normal_mid_growth_fill_percent"],
                percent_of_normal=result["percent_of_normal"],
                risk_level=result["risk_level"],
                model_version=result["model_version"],
            )
        )
    return rows, label


def save_rows(session, season_key, rows):
    session.query(TankForecast).filter(TankForecast.season_key == season_key).delete()
    session.add_all(rows)
    session.commit()


def main():
    TankForecast.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(engine)
    readings = load_readings()
    session = SessionLocal()
    for season_key in season_keys:
        rows, label = build_forecast_rows(season_key, readings)
        save_rows(session, season_key, rows)
        print(f"{season_key}: {len(rows)} forecasts saved using inputs from {label}")
    session.close()


if __name__ == "__main__":
    main()
