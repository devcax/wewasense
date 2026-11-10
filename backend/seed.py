import csv
import math
import random
import sys
from datetime import date, timedelta

from sqlalchemy import insert

import models
from config import (
    HISTORY_START_YEAR,
    MOCK_LARGE_TANK_COUNT,
    MOCK_TANK_COUNT,
    READING_INTERVAL_DAYS,
    TANKS_CSV_PATH,
)
from database import Base, SessionLocal, engine
from mock_places import (
    AGRARIAN_SERVICE_CENTRES,
    ASSOCIATION_WORDS,
    CONTACT_NAMES,
    MOCK_VILLAGES,
    TANK_NAME_CORES,
    TANK_NAME_PREFIXES,
)

LATITUDE_RANGE = (7.9, 8.9)
LONGITUDE_RANGE = (80.0, 81.0)
LOCAL_NAME_SHARE = 0.30

MONTHLY_NORMAL_CURVE = [88, 82, 72, 66, 62, 52, 42, 32, 24, 30, 55, 78]

WATER_YEAR_WETNESS = {
    2015: 0.9,
    2016: 0.55,
    2017: 0.95,
    2018: 1.05,
    2019: 0.7,
    2020: 1.0,
    2021: 1.1,
    2022: 0.95,
    2023: 0.65,
    2024: 1.05,
    2025: 0.9,
}

def round_coordinate(value):
    return round(value, 4)


def make_tank_id(latitude, longitude):
    return f"ANU_{latitude:.4f}_{longitude:.4f}"


def distance_km(lat_a, lon_a, lat_b, lon_b):
    return math.hypot((lat_a - lat_b) * 111, (lon_a - lon_b) * 110)


def nearest_village(latitude, longitude):
    closest = min(MOCK_VILLAGES, key=lambda village: distance_km(latitude, longitude, village[1], village[2]))
    return closest[0]


def random_tank_area(rng, is_large):
    if is_large:
        return round(rng.uniform(110, 200), 1)
    return round(min(100, max(1, rng.lognormvariate(2.4, 0.9))), 1)


def size_class_for_area(area_ha, is_large):
    if is_large:
        return "large"
    if area_ha >= 30:
        return "medium"
    return "small"


def random_local_name(rng):
    return f"{rng.choice(TANK_NAME_PREFIXES)}{rng.choice(TANK_NAME_CORES)}wewa"


def generate_mock_tanks(rng):
    large_indexes = set(rng.sample(range(MOCK_TANK_COUNT), MOCK_LARGE_TANK_COUNT))
    tanks = []
    used_ids = set()
    for index in range(MOCK_TANK_COUNT):
        latitude = round_coordinate(rng.uniform(*LATITUDE_RANGE))
        longitude = round_coordinate(rng.uniform(*LONGITUDE_RANGE))
        tank_id = make_tank_id(latitude, longitude)
        if tank_id in used_ids:
            continue
        used_ids.add(tank_id)
        is_large = index in large_indexes
        area_ha = random_tank_area(rng, is_large)
        tanks.append(
            {
                "tank_id": tank_id,
                "area_ha": area_ha,
                "center_lat": latitude,
                "center_lon": longitude,
                "size_class": size_class_for_area(area_ha, is_large),
            }
        )
    return tanks


def load_tanks_from_csv():
    tanks = []
    with open(TANKS_CSV_PATH, newline="", encoding="utf-8") as csv_file:
        for row in csv.DictReader(csv_file):
            tanks.append(
                {
                    "tank_id": row["tank_id"].strip(),
                    "area_ha": float(row["area_ha"]),
                    "center_lat": float(row["center_lat"]),
                    "center_lon": float(row["center_lon"]),
                    "size_class": row["size_class"].strip() or "small",
                }
            )
    return tanks


def add_names(tanks, rng):
    for tank in tanks:
        tank["nearest_village"] = nearest_village(tank["center_lat"], tank["center_lon"])
        tank["local_name"] = random_local_name(rng) if rng.random() < LOCAL_NAME_SHARE else None
    return tanks


def reading_dates(start, end):
    dates = []
    current = start
    while current <= end:
        dates.append(current)
        current += timedelta(days=READING_INTERVAL_DAYS)
    return dates


def normal_curve_value(day):
    position = (day.month - 1) + (day.day - 1) / 30.0
    lower_index = int(math.floor(position - 0.5)) % 12
    upper_index = (lower_index + 1) % 12
    weight = (position - 0.5) % 1.0
    return MONTHLY_NORMAL_CURVE[lower_index] * (1 - weight) + MONTHLY_NORMAL_CURVE[upper_index] * weight


def water_year(day):
    return day.year if day.month >= 10 else day.year - 1


def tank_wetness_for_current_year(tank, rng):
    east_dryness = (tank["center_lon"] - 80.0) * 0.25
    return max(0.3, min(1.2, rng.gauss(0.95 - east_dryness, 0.22)))


def wetness_for_day(day, tank_current_wetness, rng_cache, rng):
    year = water_year(day)
    if year not in WATER_YEAR_WETNESS:
        return tank_current_wetness
    if year not in rng_cache:
        rng_cache[year] = WATER_YEAR_WETNESS[year] * rng.uniform(0.88, 1.12)
    return rng_cache[year]


def clamp_percent(value):
    return max(2.0, min(100.0, value))


def generate_fill_series(tank, dates, rng):
    tank_factor = rng.uniform(0.85, 1.08)
    current_wetness = tank_wetness_for_current_year(tank, rng)
    year_cache = {}
    values = []
    for day in dates:
        wetness = wetness_for_day(day, current_wetness, year_cache, rng)
        level = normal_curve_value(day) * tank_factor * wetness + rng.gauss(0, 3)
        values.append(round(clamp_percent(level), 1))
    return values


def day_bin(day):
    return min(36, (day.timetuple().tm_yday - 1) // READING_INTERVAL_DAYS)


def compute_normals(dates, values):
    totals = {}
    for day, value in zip(dates, values):
        bin_key = day_bin(day)
        total, count = totals.get(bin_key, (0.0, 0))
        totals[bin_key] = (total + value, count + 1)
    return [round(totals[day_bin(day)][0] / totals[day_bin(day)][1], 1) for day in dates]


def reading_source(day, rng):
    is_cloudy_month = day.month in (10, 11, 12, 1)
    if is_cloudy_month:
        return "sentinel1" if rng.random() < 0.85 else "sentinel2"
    return "sentinel2" if rng.random() < 0.7 else "sentinel1"


def reading_is_missing(tank, day, today, rng):
    is_recent = (today - day).days <= 30
    if is_recent and tank["size_class"] == "small":
        return rng.random() < 0.25
    if is_recent:
        return rng.random() < 0.08
    return rng.random() < 0.04


def build_reading_rows(tank, dates, today, rng):
    values = generate_fill_series(tank, dates, rng)
    normals = compute_normals(dates, values)
    rows = []
    for day, value, normal in zip(dates, values, normals):
        if day != dates[0] and reading_is_missing(tank, day, today, rng):
            continue
        rows.append(
            {
                "tank_id": tank["tank_id"],
                "date": day,
                "fill_percent": value,
                "normal_percent": normal,
                "source": reading_source(day, rng),
            }
        )
    return rows


def insert_tanks(session, tanks):
    session.execute(insert(models.Tank), tanks)


def insert_readings(session, tanks, today, rng):
    dates = reading_dates(date(HISTORY_START_YEAR, 1, 1), today)
    for tank in tanks:
        session.execute(insert(models.WaterReading), build_reading_rows(tank, dates, today, rng))


def random_phone(rng):
    return "+947" + "".join(str(rng.randint(0, 9)) for _ in range(8))


def build_demo_organizations(session, tanks, rng):
    candidates = [tank for tank in tanks if tank["size_class"] != "large"]
    chosen = rng.sample(candidates, min(8, len(candidates)))
    for index, tank in enumerate(chosen):
        place = tank["local_name"] or tank["nearest_village"]
        organization = models.FarmerOrganization(
            name=f"{place} {rng.choice(ASSOCIATION_WORDS)}",
            tank_id=tank["tank_id"],
            paddy_area_ha=round(tank["area_ha"] * rng.uniform(0.8, 1.6), 1),
            agrarian_service_centre=rng.choice(AGRARIAN_SERVICE_CENTRES),
        )
        language = "ta" if index == 3 else ("en" if index == 6 else "si")
        organization.contacts.append(
            models.Contact(
                name=rng.choice(CONTACT_NAMES),
                phone=random_phone(rng),
                language=language,
                channel="whatsapp" if index % 2 == 0 else "sms",
                opted_in=True,
            )
        )
        if index % 3 == 0:
            organization.contacts.append(
                models.Contact(
                    name=rng.choice(CONTACT_NAMES),
                    phone=random_phone(rng),
                    language="si",
                    channel="sms",
                    opted_in=True,
                )
            )
        session.add(organization)


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def load_or_generate_tanks(rng):
    if TANKS_CSV_PATH.exists():
        print(f"Loading tanks from {TANKS_CSV_PATH}")
        return load_tanks_from_csv()
    print("No data/tanks.csv found, generating mock tanks")
    return generate_mock_tanks(rng)


def seed(include_demo_organizations=True):
    rng = random.Random(42)
    today = date.today()
    reset_database()
    tanks = add_names(load_or_generate_tanks(rng), rng)
    session = SessionLocal()
    try:
        insert_tanks(session, tanks)
        insert_readings(session, tanks, today, rng)
        if include_demo_organizations:
            build_demo_organizations(session, tanks, rng)
        session.commit()
    finally:
        session.close()
    print(f"Seeded {len(tanks)} tanks with water history up to {today.isoformat()}")


if __name__ == "__main__":
    seed(include_demo_organizations="--no-demo" not in sys.argv)
