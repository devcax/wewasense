from config import (
    BETHMA_THRESHOLD,
    MOCK_TANK_DEPTH_M,
    PADDY_NEAR_TANK_THRESHOLD,
    SQUARE_METRES_PER_HECTARE,
    WATER_NEEDED_PER_HECTARE_M3,
)

FULL_PADDY_ADVICE = "Full paddy cultivation is possible"
PADDY_NEAR_TANK_ADVICE = "Paddy near the tank only, outer fields to green gram or cowpea"


def tank_capacity_m3(area_ha):
    return area_ha * SQUARE_METRES_PER_HECTARE * MOCK_TANK_DEPTH_M


def usable_water_m3(capacity_m3, forecast_fill_percent):
    return capacity_m3 * (forecast_fill_percent or 0) / 100


def safe_paddy_area_ha(usable_water, paddy_area_ha):
    return min(usable_water / WATER_NEEDED_PER_HECTARE_M3, paddy_area_ha)


def percent_of_area(safe_area_ha, paddy_area_ha):
    if paddy_area_ha <= 0:
        return 0.0
    return safe_area_ha / paddy_area_ha * 100


def crop_advice_for(percent_to_cultivate):
    if percent_to_cultivate < PADDY_NEAR_TANK_THRESHOLD:
        return PADDY_NEAR_TANK_ADVICE
    return FULL_PADDY_ADVICE


def needs_bethma(percent_to_cultivate):
    return percent_to_cultivate < BETHMA_THRESHOLD


def build_plan(capacity_m3, forecast_fill_percent, paddy_area_ha):
    usable_water = usable_water_m3(capacity_m3, forecast_fill_percent)
    safe_area = safe_paddy_area_ha(usable_water, paddy_area_ha)
    percent_to_cultivate = percent_of_area(safe_area, paddy_area_ha)
    return {
        "capacity_m3": round(capacity_m3),
        "usable_water_m3": round(usable_water),
        "percent_to_cultivate": round(percent_to_cultivate),
        "safe_area_ha": round(safe_area, 1),
        "crop_advice": crop_advice_for(percent_to_cultivate),
        "bethma": needs_bethma(percent_to_cultivate),
    }


def build_plan_for_tank(area_ha, forecast_fill_percent, paddy_area_ha):
    return build_plan(tank_capacity_m3(area_ha), forecast_fill_percent, paddy_area_ha)
