import { CircleMarker, Tooltip } from "react-leaflet";
import { formatDate, formatPercent, unavailableForecastLabel } from "./format.js";
import { LARGE_RESERVOIR_COLOR, riskColor } from "./riskStyles.js";

export function displayedRisk(tank, view) {
  return view === "forecast" ? tank.risk_level : tank.current_risk_level;
}

function markerRadius(areaHa) {
  return 4 + Math.sqrt(areaHa) * 1.1;
}

function markerStyle(tank, view, isSelected) {
  const isLarge = tank.size_class === "large";
  const color = riskColor(displayedRisk(tank, view));
  if (isLarge) {
    return {
      color: isSelected ? "#0f172a" : LARGE_RESERVOIR_COLOR,
      weight: isSelected ? 3 : 2,
      fillColor: color,
      fillOpacity: 0.12,
      dashArray: "4 3",
    };
  }
  return {
    color: isSelected ? "#0f172a" : "#ffffff",
    weight: isSelected ? 3 : 1.2,
    fillColor: color,
    fillOpacity: 0.78,
  };
}

function TooltipRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function TankTooltip({ tank, view }) {
  const risk = displayedRisk(tank, view);
  return (
    <div className="min-w-[200px]">
      <div className="text-sm font-semibold text-slate-900">{tank.local_name || tank.tank_id}</div>
      {!tank.local_name && <div className="mb-1 text-[11px] text-slate-500">{tank.name}</div>}
      {tank.size_class === "large" && <div className="mb-1 text-[11px] font-medium text-slate-500">Large reservoir</div>}
      <div className="mt-1 space-y-0.5">
        <TooltipRow label="Current fill" value={formatPercent(tank.current_fill_percent)} />
        <TooltipRow label="Normal now" value={formatPercent(tank.current_normal_percent)} />
        <TooltipRow label="Forecast mid-season" value={formatPercent(tank.forecast_mid_season_fill_percent)} />
        <TooltipRow label="Normal mid-season" value={formatPercent(tank.normal_mid_season_fill_percent)} />
        <TooltipRow label={view === "forecast" ? "Forecast risk" : "Current risk"} value={risk || (view === "forecast" ? unavailableForecastLabel(tank) : "Unavailable")} />
        <TooltipRow label="Last satellite date" value={formatDate(tank.last_reading_date)} />
      </div>
    </div>
  );
}

export default function TankMarkers({ tanks, view, selectedTankId, onSelect }) {
  return tanks.map((tank) => (
    <CircleMarker
      key={tank.tank_id}
      center={[tank.center_lat, tank.center_lon]}
      radius={markerRadius(tank.area_ha)}
      pathOptions={markerStyle(tank, view, tank.tank_id === selectedTankId)}
      eventHandlers={{ click: () => onSelect(tank) }}
    >
      <Tooltip direction="top" offset={[0, -6]} opacity={1} className="tank-tooltip">
        <TankTooltip tank={tank} view={view} />
      </Tooltip>
    </CircleMarker>
  ));
}
