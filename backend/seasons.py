from datetime import date

SEASON_KEYS = ("current", "future")


def maha_season(start_year):
    return {
        "type": "maha",
        "label": f"Maha {start_year}/{str(start_year + 1)[-2:]}",
        "start": date(start_year, 10, 1),
        "end": date(start_year + 1, 3, 31),
        "mid": date(start_year + 1, 1, 1),
    }


def yala_season(year):
    return {
        "type": "yala",
        "label": f"Yala {year}",
        "start": date(year, 4, 1),
        "end": date(year, 9, 30),
        "mid": date(year, 7, 1),
    }


def current_season(today=None):
    today = today or date.today()
    if today.month >= 8:
        return maha_season(today.year)
    if today.month <= 1:
        return maha_season(today.year - 1)
    return yala_season(today.year)


def next_season(season):
    if season["type"] == "maha":
        return yala_season(season["end"].year)
    return maha_season(season["start"].year)


def resolve_season(season_key=None, today=None):
    current = current_season(today)
    if season_key == "future":
        result = next_season(current)
        result["key"] = "future"
        result["kanna"] = "Future kanna"
        return result
    current["key"] = "current"
    current["kanna"] = "Current kanna"
    return current


def season_options(today=None):
    options = []
    for key in SEASON_KEYS:
        season = resolve_season(key, today)
        options.append(
            {
                "key": key,
                "label": season["label"],
                "display": f"{season['kanna']} ({season['label']})",
                "start": season["start"].isoformat(),
                "end": season["end"].isoformat(),
                "mid": season["mid"].isoformat(),
            }
        )
    return options


def season_label_for_key(season_key):
    return resolve_season(season_key)["label"]
