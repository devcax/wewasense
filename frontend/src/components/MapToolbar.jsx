import { Search } from "lucide-react";
import { useState } from "react";
import SeasonSelector from "./SeasonSelector.jsx";

function viewOptions(season) {
  return [
    { key: "current", label: season?.current_label || "Water now" },
    { key: "forecast", label: season?.forecast_label || "Forecast" },
  ];
}

const RISK_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW"];

function ViewToggle({ view, season, onChange }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Map view">
      {viewOptions(season).map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={view === option.key}
          onClick={() => onChange(option.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            view === option.key ? "bg-white text-wewa-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RiskFilter({ riskFilter, onChange }) {
  return (
    <select value={riskFilter} onChange={(event) => onChange(event.target.value)} className="input w-auto py-2" aria-label="Risk filter">
      {RISK_FILTERS.map((level) => (
        <option key={level} value={level}>
          {level === "ALL" ? "All risk levels" : `${level} risk`}
        </option>
      ))}
    </select>
  );
}

function matchesSearch(tank, searchText) {
  const text = searchText.toLowerCase();
  return tank.tank_id.toLowerCase().includes(text) || tank.name.toLowerCase().includes(text);
}

export function searchTanks(tanks, searchText, limit = 6) {
  if (!searchText.trim()) {
    return [];
  }
  return tanks.filter((tank) => matchesSearch(tank, searchText.trim())).slice(0, limit);
}

function TankSearch({ tanks, onSelect }) {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const matches = searchTanks(tanks, searchText);

  const choose = (tank) => {
    onSelect(tank);
    setSearchText("");
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-[200px] flex-[1_1_240px]">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={searchText}
        onChange={(event) => {
          setSearchText(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => event.key === "Enter" && matches[0] && choose(matches[0])}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Search tank ID or name"
        aria-label="Search tank ID or name"
        className="input py-2 pl-9"
      />
      {isOpen && searchText && (
        <div className="absolute left-0 right-0 top-full z-[1100] mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">No tanks match "{searchText}"</div>}
          {matches.map((tank) => (
            <button
              key={tank.tank_id}
              onMouseDown={() => choose(tank)}
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              <div className="text-sm font-medium text-slate-800">{tank.name}</div>
              <div className="text-[11px] text-slate-500">{tank.tank_id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapToolbar({ tanks, view, season, onViewChange, riskFilter, onRiskFilterChange, onSelectTank, loading }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SeasonSelector className="min-w-[220px] flex-1 sm:flex-none" />
      <ViewToggle view={view} season={season} onChange={onViewChange} />
      <TankSearch tanks={tanks} onSelect={onSelectTank} />
      <RiskFilter riskFilter={riskFilter} onChange={onRiskFilterChange} />
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-wewa-200 border-t-wewa-600" />}
    </div>
  );
}
