import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { useAppSettings } from "../components/AppSettings.jsx";
import { RiskBadge } from "../components/Badges.jsx";
import DateRangeSelector, { presetRange } from "../components/DateRangeSelector.jsx";
import EmptyState from "../components/EmptyState.jsx";
import HistoryChart from "../components/HistoryChart.jsx";
import SeasonSelector from "../components/SeasonSelector.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { formatNumber, formatPercent } from "../components/format.js";

function Section({ title, actions, children, delay = 0, className = "" }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`card p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {actions}
      </div>
      {children}
    </motion.section>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function TankHeader({ tank }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-wewa-600 hover:underline">
          <ArrowLeft size={14} /> Back to map
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tank.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="font-mono text-xs">{tank.tank_id}</span>
          <span>{tank.area_ha} ha · {tank.size_class}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} /> {tank.center_lat.toFixed(4)}, {tank.center_lon.toFixed(4)}
          </span>
          <a href={tank.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-wewa-600 hover:underline">
            Open in Google Maps <ExternalLink size={13} />
          </a>
        </div>
      </div>
      <SeasonSelector />
    </div>
  );
}

function ForecastCard({ tank }) {
  const [mode, setMode] = useState("pre");
  const [inputs, setInputs] = useState({ fill_at_planting: "", rain_30d: "", rain_60d: "", fill_at_update: "", rain_after_30d: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { setResult(null); setError(""); }, [tank.tank_id, tank.season.key, mode]);
  const fields = mode === "pre"
    ? [["fill_at_planting", "Fill at planting (%)", 100], ["rain_30d", "Rain in prior 30 days (mm)"], ["rain_60d", "Rain in prior 60 days (mm)"]]
    : [["fill_at_planting", "Fill at planting (%)", 100], ["fill_at_update", "Fill at update (%)", 100], ["rain_60d", "Rain in prior 60 days (mm)"], ["rain_after_30d", "Rain after planting, 30 days (mm)"]];
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const payload = Object.fromEntries(fields.map(([key]) => [key, Number(inputs[key])]));
      setResult(await api.forecastTank(tank.tank_id, { season: tank.season.key, ...payload }));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return (
    <Section title={`Forecast · ${tank.season.label}`} delay={0.05}>
      <p className="mb-3 text-sm text-slate-500">Enter observed values to run the trained model. Results are not saved to the map or season plans.</p>
      <label className="block text-sm font-medium text-slate-700">Model
        <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={mode} onChange={(e) => setMode(e.target.value)}><option value="pre">Pre-season</option><option value="update">Season update</option></select>
      </label>
      <form onSubmit={submit} className="mt-3 space-y-3">
        {fields.map(([key, label, max]) => <label key={key} className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 p-2" type="number" min="0" max={max} step="any" required value={inputs[key]} onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })} /></label>)}
        <button className="btn-primary" disabled={loading}>{loading ? "Calculating…" : "Calculate forecast"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {result && <div className="mt-4 space-y-2" aria-live="polite"><RiskBadge level={result.risk_level} /><div className="grid grid-cols-2 gap-3"><Stat label="Forecast" value={formatPercent(result.forecast_mid_growth_fill_percent, 1)} hint="Mid-season" /><Stat label="Normal" value={formatPercent(result.normal_mid_growth_fill_percent, 1)} hint="Mid-season" /></div><p className="text-xs text-slate-500">Model {result.model_version} · {result.percent_of_normal == null ? "Normal unavailable" : `${result.percent_of_normal}% of normal`}</p></div>}
    </Section>
  );
}

function PlanCard({ plan }) {
  return (
    <Section title="Planting plan" delay={0.1}>
      <div className="mb-4 flex items-end gap-4">
        <div className="text-4xl font-bold text-paddy-700">{formatPercent(plan.percent_to_cultivate)}</div>
        <div className="pb-1 text-sm text-slate-500">of paddy fields can be cultivated safely</div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-paddy-500" initial={{ width: 0 }} animate={{ width: `${plan.percent_to_cultivate}%` }} transition={{ duration: 0.8 }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Safe area" value={`${plan.safe_area_ha} ha`} hint={`of ${plan.paddy_area_ha} ha paddy${plan.paddy_area_is_estimate ? " (estimated)" : ""}`} />
        <Stat label="Bethma" value={plan.bethma ? "Yes" : "No"} hint={plan.bethma ? "Shared cultivation near tank" : "Not needed"} />
        <Stat label="Usable water" value={`${formatNumber(plan.usable_water_m3 / 1000)}k m³`} hint={`Capacity ${formatNumber(plan.capacity_m3 / 1000)}k m³`} />
      </div>
      <div className="mt-4 rounded-xl bg-paddy-50 p-3 text-sm text-paddy-800">{plan.crop_advice}</div>
    </Section>
  );
}

function OrganizationList({ tank }) {
  const registerLink = `/organizations/new?tank=${encodeURIComponent(tank.tank_id)}`;
  return (
    <Section
      title="Farmer organizations"
      delay={0.2}
      actions={
        <Link to={registerLink} className="btn-primary py-1.5">
          Register organization
        </Link>
      }
    >
      {tank.organizations.length === 0 ? (
        <EmptyState icon={Users} title="No organizations registered for this tank yet" description="Register the farmer organization that uses this tank so it can receive season plans." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tank.organizations.map((organization) => (
            <li key={organization.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium text-slate-800">{organization.name}</div>
                <div className="text-xs text-slate-500">
                  {organization.agrarian_service_centre} ASC · {organization.paddy_area_ha} ha paddy · {organization.contact_count} contacts
                </div>
              </div>
              <Link to={`/organizations/${organization.id}/edit`} className="btn-ghost py-1 text-xs">Edit</Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function HistorySection({ tankId }) {
  const [preset, setPreset] = useState("3y");
  const [range, setRange] = useState(presetRange("3y"));
  const history = useApiData(() => api.getTankHistory(tankId, range.start, range.end), [tankId, range.start, range.end]);

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  return (
    <Section
      title="Water level history"
      delay={0.15}
      className="lg:col-span-2"
      actions={<DateRangeSelector preset={preset} range={range} onPresetChange={choosePreset} onRangeChange={(next) => { setPreset("custom"); setRange(next); }} />}
    >
      {history.loading && !history.data ? (
        <Skeleton className="h-[300px] w-full" />
      ) : history.data?.length ? (
        <HistoryChart readings={history.data} />
      ) : (
        <EmptyState title="No readings in this date range" description="Try a wider date range." />
      )}
    </Section>
  );
}

function DetailsSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-16 w-1/2" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

export default function TankDetails() {
  const { tankId } = useParams();
  const { seasonKey } = useAppSettings();
  const details = useApiData(() => api.getTank(tankId, seasonKey), [tankId, seasonKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tankId]);

  if (details.loading && !details.data) {
    return <DetailsSkeleton />;
  }
  if (details.error) {
    return (
      <div className="p-6">
        <EmptyState title="Tank not found" description={details.error} action={<Link to="/" className="btn-primary">Back to map</Link>} />
      </div>
    );
  }
  const tank = details.data;
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <TankHeader tank={tank} />
      <div className="grid gap-4 lg:grid-cols-3">
        <HistorySection tankId={tankId} />
        <ForecastCard tank={tank} />
        {tank.plan && <PlanCard plan={tank.plan} />}
        <div className="lg:col-span-2">
          <OrganizationList tank={tank} />
        </div>
      </div>
    </div>
  );
}
