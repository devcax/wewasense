# WewaSense

Tank water and season planning dashboard for agrarian officers in Anuradhapura district, Sri Lanka.

Dry-zone farmers grow paddy with water from village tanks (wewa). Before each season, farmer organizations agree at the kanna meeting how much land to cultivate. WewaSense forecasts each tank's water level at mid-season and turns it into a planting plan that officers review, approve and send to farmer organizations by SMS or WhatsApp.

- **Maha** runs October to March. **Yala** runs April to September.
- **Current kanna** is the season being planned now. **Future kanna** is the next one.
- Officers use the dashboard. Farmer organizations never log in. They receive messages and reply `1` (planted), `2` (not planted) or `3` (crop failed).

> The supplied model files provide tank locations, normals and trained models. Forecasts require observed fill and rainfall values entered on the tank details page. Those forecasts are not saved to the map or used in bulk plans. The optional demo seed still generates mock readings and monitoring data.

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | React 18 (Vite), Tailwind CSS, react-leaflet, Recharts, Framer Motion, React Router, lucide-react, react-hot-toast |
| Backend | Python FastAPI, SQLAlchemy, SQLite |
| Messaging | `MockProvider` (default), `TwilioSmsProvider`, `WhatsAppCloudProvider` |

## Run it

You need Python 3.10+ and Node 18+.

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

The API runs on http://localhost:8000 and the interactive docs are at http://localhost:8000/docs.

On first start, the backend imports tank locations from `backend/model_files/tanks.csv` into an empty database without deleting existing records. If you previously ran the demo seed, its tanks and readings remain in your database; back up that database before replacing it. `python seed.py` is optional and destructive: it resets the database and generates demo data.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api/*` to the backend on port 8000. To point at a different backend, set `VITE_BACKEND_URL` for the dev proxy, or `VITE_API_URL` to call an API URL directly.

Everything works with no API keys: messages go through `MockProvider`, which marks them sent after a short delay.

## Pages

| Page | Path | What it does |
| --- | --- | --- |
| Tank Map | `/` | Full-screen map of all tanks. Circles are sized by area and coloured by risk (green LOW, amber MEDIUM, red HIGH). Large reservoirs have grey dashed outlines. Hover for a tooltip, click for a side panel. Top bar has the season selector, a current/forecast toggle, search and a risk filter. Summary cards with animated counters can also filter by risk. |
| Tank Details | `/tanks/:tankId` | Header with Google Maps link, fill history chart with the normal range shaded and a date-range selector, forecast card, animated prediction flow, planting plan card and linked organizations. |
| Register Organization | `/organizations/new` | Five-step wizard: organization, tank (map or search, with an optional local name), paddy area, contacts with consent, review. Shows a confirmation animation on success. Also used for editing (`/organizations/:id/edit`). |
| Organizations | `/organizations` | List of all organizations with search, edit and delete. |
| Season Plans and Alerts | `/plans` | Generate draft plans for a season, preview each message in a phone mockup (SMS or WhatsApp style) in the contact's language, edit the text, approve, send. Status updates live: draft → approved → sending → sent or failed. |
| Messages and Replies | `/messages` | Inbox of replies matched to organizations, with counts of planted / not planted / crop failed. "Simulate reply" creates a demo reply. |
| Data Health and Drift | `/data-health` | Freshness of Sentinel-1, Sentinel-2, CHIRPS, ERA5, ENSO and IOD, satellite coverage, feature drift (PSI table, bar chart and trend), forecast vs actual over past seasons, and the model version. |

### Screenshot list

Screenshots to capture for documentation or a demo:

1. **Tank Map**: default view, Current kanna, Forecast mid-season level.
2. **Tank Map, tooltip**: hovering a tank.
3. **Tank Map, side panel**: a tank selected.
4. **Tank Map, Future kanna**: season switched to Yala, showing the colour change.
5. **Tank Details**: history chart, forecast card and prediction flow.
6. **Tank Details, lower half**: planting plan and the empty state "No organizations registered for this tank yet".
7. **Register Organization, step 2**: tank picked on the small map.
8. **Register Organization, step 4**: contacts with consent checkbox.
9. **Register Organization, success**: confirmation animation.
10. **Organizations list**.
11. **Season Plans**: table after "Generate plans".
12. **Season Plans, preview**: WhatsApp-style phone mockup with editable text.
13. **Season Plans, sent**: status changed to sent after "Approve and send".
14. **Messages and Replies**: inbox after a few simulated replies.
15. **Data Health**: freshness cards and coverage charts.
16. **Data Health, drift and performance**: PSI chart, table and forecast vs actual chart.

## How forecasts and plans work

### Prediction service (`backend/prediction_service.py`)

On a tank details page, select the pre-season or update model and enter measured planting fill and rainfall values. The update model also requires update fill and rainfall after planting. The model uses the supplied tank profiles and monthly normals. A tank without a matching profile or normals cannot be forecast. Model confidence is not supplied by these model files.

### Planting plan (`backend/plan_service.py`)

- Capacity (m³) = area_ha × 10,000 × 1.5 (mock depth)
- Usable water = capacity × forecast fill %
- Safe paddy area = usable water ÷ water needed per hectare (10,000 m³, set in `config.py` or with `WATER_NEEDED_PER_HECTARE_M3`), capped at the organization's paddy area
- Percent to cultivate = safe area ÷ paddy area
- Below 70%: "Paddy near the tank only, outer fields to green gram or cowpea"
- Below 50%: bethma is also recommended

## Data availability

The CSV files do not include live rainfall or water observations. Individual forecasts are calculated from user-entered observations and are not persisted; the map and bulk plan generation therefore do not show or use these results. The optional demo seed supplies simulated water history, data health and messaging data. Live ingestion and stored forecast inputs are needed for automatic map forecasts and season plans.

## Messaging

Providers live in `backend/messaging/providers.py`. Each has `send_message(phone, text, channel)` and returns a status and a provider message ID.

| Provider | Used when |
| --- | --- |
| `MockProvider` | Default. Marks the message sent after `MOCK_SEND_DELAY_SECONDS` (3 s). Phone numbers ending in `0000` fail, so you can demo the failed state. |
| `TwilioSmsProvider` | Contact channel is SMS and the Twilio keys are set. |
| `WhatsAppCloudProvider` | Contact channel is WhatsApp and the WhatsApp Cloud API keys are set. |

Copy `backend/.env.example` to `backend/.env` and fill in the keys you have. Missing keys fall back to `MockProvider`.

Rules:

- Plans are created as drafts. A plan can only be sent after an officer approves it. The API refuses to send a draft.
- Only contacts who gave consent (`opted_in`) receive messages.
- Message templates are in `backend/messaging/templates.py`. The English template is used as written. **Sinhala and Tamil are placeholder translations marked `[REVIEW TRANSLATION]` and need review by a native speaker before field use.**
- If an officer edits the text, contacts with the same language as the plan receive the edited text. Contacts with another language receive the generated text in their language.

### Inbound replies

- `POST /webhooks/sms` accepts Twilio form posts (`From`, `Body`) or JSON (`from`, `text`).
- `POST /webhooks/whatsapp` accepts Meta WhatsApp Cloud webhook payloads. `GET /webhooks/whatsapp` answers Meta's verification challenge using `WHATSAPP_VERIFY_TOKEN`.

Replies are matched to a contact by phone number, linked to the organization's latest plan, and parsed for `1`, `2` or `3`.

Example:

```bash
curl -X POST http://localhost:8000/webhooks/sms -d "From=+94771234567" -d "Body=1"
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/meta` | Model version, mock flag, messaging providers, seasons |
| GET | `/tanks?season=current\|future&view=current\|forecast` | All tanks with fill, normal, forecast and risk |
| GET | `/tanks/{tank_id}?season=` | Tank details, forecast, signals, plan, organizations |
| GET | `/tanks/{tank_id}/history?start=&end=` | Water readings |
| GET | `/summary?season=&view=` | Counts by risk and average fill |
| GET, POST | `/organizations` | List (optional `tank_id`) or create |
| GET, PUT, DELETE | `/organizations/{id}` | Read, update or delete |
| POST | `/plans/generate?season=` | Create draft plans for all organizations |
| GET | `/plans?season=` | List plans |
| PUT | `/plans/{id}` | Edit message text |
| POST | `/plans/{id}/approve` | Approve |
| POST | `/plans/{id}/send` | Send an approved plan |
| POST | `/plans/send-approved?season=` | Send all approved plans |
| GET | `/messages?direction=` | Messages and reply counts |
| POST | `/messages/simulate-reply` | Create a demo reply |
| POST | `/webhooks/sms`, `/webhooks/whatsapp` | Inbound replies |
| GET | `/drift`, `/data-health`, `/model-performance` | Data health and model monitoring |

## Project structure

```
backend/
  main.py                FastAPI app and routers
  config.py              Settings, thresholds and .env loading
  database.py            SQLAlchemy engine and session
  models.py              Database tables
  seasons.py             Maha/Yala season dates
  seed.py                Mock data generator (python seed.py)
  mock_places.py         Mock village and name lists
  prediction_service.py  get_forecast (swap for the real model)
  plan_service.py        Planting plan rules
  routes/                tanks, organizations, plans, messages, drift
  messaging/             providers.py, templates.py
  requirements.txt
  .env.example
frontend/
  src/pages/             TankMap, TankDetails, RegisterOrganization, Organizations, SeasonPlans, Messages, DataHealth
  src/components/        Shared UI (map markers, charts, badges, phone mockup, wizard parts)
  src/api/               API client and data hook
```

The repository root is the `wewasense-app/` folder from the original specification.

## Database tables

`tanks`, `water_readings`, `farmer_organizations`, `contacts`, `season_plans`, `messages`, `drift_snapshots`, plus two tables that hold mock monitoring values: `data_sources` (freshness) and `model_performance` (forecast vs actual per past season). `messages` also stores `from_phone` and `reply_code` for inbound replies, and `season_plans` stores `safe_area_ha` and `message_language`.
