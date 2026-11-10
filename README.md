# WewaSense

WewaSense helps agrarian officers in Anuradhapura, Sri Lanka, plan each paddy season.

It shows how much water each village tank (wewa) has now, forecasts how much it will have in the middle of the season, and turns that forecast into a planting plan. Officers review the plan and send it to farmer organizations by SMS or WhatsApp.

- **Maha** season: October to March. The forecast is for **January**.
- **Yala** season: April to September. The forecast is for **July**.

---

## Architecture

```
 model_files/water_clean.csv ──► load_water.py ──────────┐
                                                         ▼
 model_files/tanks.csv ─────────► backend start ──► SQLite database (wewasense.db)
                                                         ▲
 model_files/rain_features.csv ─┐                        │
 model_files/*.joblib ──────────┴► compute_forecasts.py ─┘
                                                         │
                                                         ▼
                                              FastAPI backend (port 8000)
                                                         │
                                         ┌───────────────┴───────────────┐
                                         ▼                               ▼
                               React dashboard (port 5173)     SMS (Twilio) / WhatsApp (Meta)
```

1. **Data** comes from satellite water levels (Sentinel-1) and rainfall (GPM).
2. **The model** (LightGBM) uses the water level at planting and the rain before planting to forecast the mid-season water level.
3. **The backend** stores everything in SQLite and serves it as a JSON API.
4. **The dashboard** shows maps, plans, messages and data health.
5. **Messages** go to farmer organizations through Twilio (SMS) or the WhatsApp Cloud API.

## Tech stack

| Part | Tools |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, SQLite, pandas, LightGBM |
| Frontend | React (Vite), Tailwind CSS, Leaflet map, Recharts |
| Messaging | Twilio SMS, Meta WhatsApp Cloud API |

---

## Folder structure

```
wewasense/
├── backend/
│   ├── main.py                  Starts the API and loads tanks on first run
│   ├── config.py                Settings and .env loading
│   ├── database.py              Database connection
│   ├── models.py                Database tables
│   ├── seasons.py               Maha and Yala season dates
│   ├── prediction_service.py    Loads the model and makes forecasts
│   ├── plan_service.py          Turns a forecast into a planting plan
│   ├── data_health_service.py   Data freshness, drift and model accuracy
│   ├── load_water.py            Loads water readings into the database
│   ├── compute_forecasts.py     Computes and saves forecasts for every tank
│   ├── routes/
│   │   ├── tanks.py             Tanks, map, summary, tank details
│   │   ├── organizations.py     Farmer organizations and contacts
│   │   ├── plans.py             Season plans
│   │   ├── messages.py          Sent messages, replies, webhooks
│   │   └── drift.py             Data health and drift
│   ├── messaging/
│   │   ├── providers.py         Twilio and WhatsApp sending
│   │   └── templates.py         Message text in English, Sinhala and Tamil
│   ├── model_files/             Data and trained models (see below)
│   ├── requirements.txt
│   └── .env.example             Template for API keys
└── frontend/
    ├── src/pages/               One file per dashboard page
    ├── src/components/          Shared parts (map, charts, badges, phone preview)
    ├── src/api/                 Calls to the backend
    └── package.json
```

### Data files (`backend/model_files/`)

| File | What it contains |
| --- | --- |
| `tanks.csv` | Every tank: ID, area (ha), location, size class |
| `water_clean.csv` | Water level (% full) for each tank, about every 12 days, from 2016 |
| `rain_features.csv` | Rain in the 30 and 60 days before planting, per tank and season |
| `tank_profiles.csv` | Tank details the model needs (tanks of 5 ha or more) |
| `tank_normals_train.csv` | Normal water level for each tank and month |
| `wewasense_model_v1.joblib` | Pre-season forecast model |
| `wewasense_update_model_v1.joblib` | Mid-season update model |

The model was trained on seasons up to **Maha 2022** (data until 31 January 2023). Later seasons are used to check its accuracy.

### Database tables

| Table | What it stores |
| --- | --- |
| `tanks` | Tank list |
| `water_readings` | Water level history |
| `tank_forecasts` | Saved forecasts per season and tank |
| `farmer_organizations` | Farmer organizations and their tank |
| `contacts` | People who receive messages, with language and channel |
| `season_plans` | Planting plans and their status |
| `messages` | Sent messages and received replies |

---

## Setup

You need **Python 3.10+** and **Node 18+**.

### 1. Backend

```bash
cd backend
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn main:app --reload
```

On the first start, the backend creates the database and loads all tanks from `tanks.csv`. Stop it with `Ctrl+C` after it starts.

### 2. Load data and forecasts

Run these from the `backend` folder:

```bash
python load_water.py          # loads water levels into the database
python compute_forecasts.py   # computes forecasts for every tank
```

Run both again whenever `water_clean.csv` or `rain_features.csv` is updated.

### 3. Start the backend

```bash
python -m uvicorn main:app --reload
```

- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

The frontend sends requests to `/api/...`, and Vite forwards them to the backend on port 8000. To use another backend address, set `VITE_BACKEND_URL`.

### 5. Messaging keys (optional)

Open `backend/.env` and fill in the keys you have:

| Key | Used for |
| --- | --- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Sending SMS |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Sending WhatsApp messages |
| `WHATSAPP_VERIFY_TOKEN` | Connecting the WhatsApp webhook |

Without keys for a channel, messages on that channel are not sent and are marked as **failed** in the dashboard.

Never commit `.env`. It is already in `.gitignore`.

---

## Dashboard pages

| Page | Address | What you can do |
| --- | --- | --- |
| **Tank Map** | `/` | See all tanks on a map. Switch between **Water now** and **Forecast** (January for Maha, July for Yala). Colours show risk: green LOW, amber MEDIUM, red HIGH, grey no forecast. Search tanks and filter by risk. Click a tank for details. |
| **Tank Details** | `/tanks/:tankId` | Water level history, forecast, model inputs, planting plan and linked organizations. You can also enter values by hand to run the model. |
| **Register Organization** | `/organizations/new` | Add a farmer organization step by step: name, tank, paddy area, contacts. |
| **Organizations** | `/organizations` | View, edit and delete organizations. |
| **Season Plans** | `/plans` | Generate plans, preview the message, edit, approve, send, resend and delete plans. |
| **Messages** | `/messages` | See sent messages and farmer replies. Resend a message. |
| **Data Health** | `/data-health` | Latest dates for water and rain data, satellite coverage, drift of model inputs, and model accuracy on past seasons. |

### Risk levels

The forecast is compared with the tank's normal level for that month:

| Risk | Meaning |
| --- | --- |
| HIGH | Forecast is below 80% of normal |
| MEDIUM | Forecast is between 80% and 95% of normal |
| LOW | Forecast is 95% of normal or more |

Tanks under 5 ha are shown as **Too small to forecast**. A season shows **No forecast yet** until the water level and rain at planting are available.

---

## How a plan is made

1. The forecast gives the expected water level in the middle of the season.
2. Usable water = tank area × 1.5 m depth × forecast % full.
3. Safe paddy area = usable water ÷ 10,000 m³ per hectare, up to the organization's paddy area.
4. Advice:
   - 70% of the area or more: full paddy cultivation.
   - Below 70%: paddy near the tank only, other crops (green gram, cowpea) in outer fields.
   - Below 50%: bethma (sharing a smaller area near the tank) is also recommended.

Plans are created as **drafts**. An officer must **approve** a plan before it can be sent. Only contacts who agreed to receive messages get them.

Messages are written in the contact's language (English, Sinhala or Tamil). The Sinhala and Tamil text should be checked by a native speaker before real use.

---

## Backend API

All paths are on `http://localhost:8000`. Full details are at `/docs`.

### Tanks and seasons

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/seasons` | Current and next season |
| GET | `/tanks?season=current&view=forecast` | All tanks with water level, forecast and risk |
| GET | `/summary?season=current&view=forecast` | Number of tanks per risk level |
| GET | `/tanks/{tank_id}?season=current` | One tank with forecast, inputs and plan |
| GET | `/tanks/{tank_id}/history?start=&end=` | Water level history |
| POST | `/tanks/{tank_id}/forecast` | Run the model with values you enter |

`season` is `current` or `future`. `view` is `current` (water now) or `forecast`.

### Organizations

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/organizations` | List organizations |
| POST | `/organizations` | Add an organization |
| GET | `/organizations/{id}` | One organization |
| PUT | `/organizations/{id}` | Update an organization |
| DELETE | `/organizations/{id}` | Delete an organization |

### Season plans

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/plans/generate?season=current` | Create draft plans for all organizations |
| GET | `/plans?season=current` | List plans |
| PUT | `/plans/{id}` | Edit the message text |
| POST | `/plans/{id}/approve` | Approve a plan |
| POST | `/plans/{id}/send` | Send or resend a plan |
| POST | `/plans/send-approved?season=current` | Send all approved plans |
| DELETE | `/plans/{id}` | Delete a plan (sent messages are kept) |

### Messages

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/messages?direction=inbound` | List messages (`inbound` or `outbound`) |
| POST | `/messages/{id}/resend` | Send a message again |
| DELETE | `/messages/{id}` | Delete a sent message |
| POST | `/webhooks/sms` | Receive SMS replies from Twilio |
| GET, POST | `/webhooks/whatsapp` | Receive WhatsApp replies from Meta |

### Data health

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/data-health` | Latest data dates and satellite coverage |
| GET | `/drift` | How much the latest model inputs differ from the training data |
| GET | `/model-performance` | Forecast compared with actual water level for past seasons |
