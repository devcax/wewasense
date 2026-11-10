from plan_service import FULL_PADDY_ADVICE, PADDY_NEAR_TANK_ADVICE

TRANSLATION_REVIEW_NOTE = "Sinhala and Tamil texts are placeholder translations and must be reviewed before field use."

MESSAGE_TEMPLATES = {
    "en": (
        "WewaSense – {season}\n"
        "{organization_name}\n"
        "{tank_line}\n"
        "\n"
        "Tank water in {month}: about {forecast_fill}% full.\n"
        "{risk_sentence}\n"
        "\n"
        "Plan: cultivate {safe_area} ha of your {paddy_area} ha.\n"
        "{crop_advice}.\n"
        "{bethma_text}"
    ),
    "si": (
        "WewaSense – {season}\n"
        "{organization_name}\n"
        "{tank_line}\n"
        "\n"
        "{month} වන විට වැවේ ජලය: {forecast_fill}% පමණ.\n"
        "{risk_sentence}\n"
        "\n"
        "සැලැස්ම: ඔබේ කුඹුරු හෙක්ටයාර {paddy_area} න් හෙක්ටයාර {safe_area} ක් වගා කරන්න.\n"
        "{crop_advice}.\n"
        "{bethma_text}"
    ),
    "ta": (
        "WewaSense – {season}\n"
        "{organization_name}\n"
        "{tank_line}\n"
        "\n"
        "{month} மாதத்தில் குளத்தின் நீர்: சுமார் {forecast_fill}%.\n"
        "{risk_sentence}\n"
        "\n"
        "திட்டம்: உங்கள் {paddy_area} ஹெக்டேர் வயலில் {safe_area} ஹெக்டேர் பயிரிடுங்கள்.\n"
        "{crop_advice}.\n"
        "{bethma_text}"
    ),
}

SEASON_NAMES = {
    "Maha": {"en": "Maha season", "si": "මහ කන්නය", "ta": "மகா பருவம்"},
    "Yala": {"en": "Yala season", "si": "යල කන්නය", "ta": "யால பருவம்"},
}

MID_SEASON_MONTHS = {
    "Maha": {"en": "January", "si": "ජනවාරි", "ta": "ஜனவரி"},
    "Yala": {"en": "July", "si": "ජූලි", "ta": "ஜூலை"},
}

TANK_LINES = {"en": "Tank: {name}", "si": "වැව: {name}", "ta": "குளம்: {name}"}

RISK_SENTENCES = {
    "HIGH": {
        "en": "Water may run short (high risk).",
        "si": "ජලය හිඟ විය හැක (අවදානම ඉහළයි).",
        "ta": "நீர் பற்றாக்குறை ஏற்படலாம் (அதிக அபாயம்).",
    },
    "MEDIUM": {
        "en": "Water may be a little low (medium risk).",
        "si": "ජලය මඳක් අඩු විය හැක (මධ්‍යම අවදානම).",
        "ta": "நீர் சற்று குறைவாக இருக்கலாம் (நடுத்தர அபாயம்).",
    },
    "LOW": {
        "en": "Water should be enough (low risk).",
        "si": "ජලය ප්‍රමාණවත් විය යුතුය (අවදානම අඩුයි).",
        "ta": "நீர் போதுமானதாக இருக்கும் (குறைந்த அபாயம்).",
    },
}

CROP_ADVICE_TRANSLATIONS = {
    FULL_PADDY_ADVICE: {
        "en": FULL_PADDY_ADVICE,
        "si": "සම්පූර්ණ කුඹුරු වගාව කළ හැක",
        "ta": "முழு நெல் சாகுபடி செய்யலாம்",
    },
    PADDY_NEAR_TANK_ADVICE: {
        "en": PADDY_NEAR_TANK_ADVICE,
        "si": "වැව ආසන්න කුඹුරු පමණක් වී වගා කරන්න, පිටත කුඹුරුවලට මුං හෝ කව්පි",
        "ta": "குளத்தின் அருகே மட்டும் நெல், வெளி வயல்களில் பச்சைப்பயறு அல்லது காராமணி",
    },
}

BETHMA_TEXTS = {
    True: {
        "en": "Bethma recommended: share a smaller area near the tank.",
        "si": "බෙත්ම ක්‍රමය නිර්දේශිතයි: වැව ආසන්න කුඩා ප්‍රදේශයක් බෙදා වගා කරන්න.",
        "ta": "பெத்மா பரிந்துரைக்கப்படுகிறது: குளத்தின் அருகே சிறிய பகுதியை பகிர்ந்து பயிரிடுங்கள்.",
    },
    False: {"en": "", "si": "", "ta": ""},
}

REPLY_MEANINGS = {"1": "planted", "2": "not planted", "3": "crop failed"}


def supported_language(language):
    return language if language in MESSAGE_TEMPLATES else "en"


def translate_crop_advice(crop_advice, language):
    return CROP_ADVICE_TRANSLATIONS.get(crop_advice, {}).get(language, crop_advice)


def tidy_lines(text):
    lines = [" ".join(line.split()) for line in text.split("\n")]
    tidy = []
    for line in lines:
        if line or (tidy and tidy[-1]):
            tidy.append(line)
    return "\n".join(tidy).strip()


def split_season_label(season_label):
    season_type, years = season_label.split(" ", 1)
    return season_type, years


def format_hectares(value):
    return f"{value:g}" if value == int(value) else f"{value:.1f}"


def render_plan_message(language, season_label, organization_name, tank_name, forecast_fill, risk, safe_area, paddy_area, crop_advice, bethma):
    language = supported_language(language)
    season_type, years = split_season_label(season_label)
    text = MESSAGE_TEMPLATES[language].format(
        season=f"{SEASON_NAMES.get(season_type, {}).get(language, season_type)} {years}",
        organization_name=organization_name,
        tank_line=TANK_LINES[language].format(name=tank_name) if tank_name else "",
        month=MID_SEASON_MONTHS.get(season_type, {}).get(language, ""),
        forecast_fill=round(forecast_fill),
        risk_sentence=RISK_SENTENCES.get(risk, {}).get(language, ""),
        safe_area=format_hectares(round(safe_area, 1)),
        paddy_area=format_hectares(round(paddy_area, 1)),
        crop_advice=translate_crop_advice(crop_advice, language),
        bethma_text=BETHMA_TEXTS[bool(bethma)][language],
    )
    return tidy_lines(text)
