import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
TANKS_CSV_PATH = BACKEND_DIR / "model_files" / "tanks.csv"

load_dotenv(BACKEND_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'wewasense.db'}")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

WATER_NEEDED_PER_HECTARE_M3 = float(os.getenv("WATER_NEEDED_PER_HECTARE_M3", "10000"))
MOCK_TANK_DEPTH_M = 1.5
SQUARE_METRES_PER_HECTARE = 10000

LOW_RISK_RATIO = 0.85
HIGH_RISK_RATIO = 0.60
PADDY_NEAR_TANK_THRESHOLD = 70
BETHMA_THRESHOLD = 50

MODEL_VERSION = "pre-season-v1 / update-v1"
USES_MOCK_PREDICTIONS = False

MOCK_TANK_COUNT = 300
MOCK_LARGE_TANK_COUNT = 15
HISTORY_START_YEAR = 2016
READING_INTERVAL_DAYS = 10

MOCK_SEND_DELAY_SECONDS = float(os.getenv("MOCK_SEND_DELAY_SECONDS", "3"))

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "wewasense-verify")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v20.0")


def has_twilio_keys():
    return all(value.strip() for value in (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER))


def has_whatsapp_keys():
    return all(value.strip() for value in (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID))
