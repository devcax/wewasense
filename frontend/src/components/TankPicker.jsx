import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { searchTanks } from "./MapToolbar.jsx";
import { riskColor } from "./riskStyles.js";

function FocusTank({ tank }) {
  const map = useMap();
  useEffect(() => {
    if (tank) {
      map.flyTo([tank.center_lat, tank.center_lon], Math.max(map.getZoom(), 11), { duration: 0.6 });
    }
  }, [tank?.tank_id]);
  return null;
}

function SearchResults({ results, onSelect }) {
  if (!results.length) {
    return null;
  }
  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
      {results.map((tank) => (
        <button key={tank.tank_id} type="button" onClick={() => onSelect(tank)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
          <div className="text-sm font-medium text-slate-800">{tank.name}</div>
          <div className="text-[11px] text-slate-500">{tank.tank_id} · {tank.area_ha} ha</div>
        </button>
      ))}
    </div>
  );
}

export default function TankPicker({ tanks, selectedTank, onSelect }) {
  const [searchText, setSearchText] = useState("");
  const results = searchTanks(tanks, searchText, 8);

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-2">
        <label className="label">Search by tank ID or name</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="e.g. ANU_8.33 or Kudawewa" className="input pl-9" />
        </div>
        <SearchResults results={results} onSelect={(tank) => { onSelect(tank); setSearchText(""); }} />
        <p className="mt-2 text-xs text-slate-500">Or click a tank on the map.</p>
      </div>
      <div className="h-[300px] overflow-hidden rounded-2xl border border-slate-200 md:col-span-3">
        <MapContainer center={[8.38, 80.5]} zoom={9} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {tanks.map((tank) => {
            const isSelected = selectedTank?.tank_id === tank.tank_id;
            return (
              <CircleMarker
                key={tank.tank_id}
                center={[tank.center_lat, tank.center_lon]}
                radius={isSelected ? 9 : 3 + Math.sqrt(tank.area_ha) * 0.6}
                pathOptions={{ color: isSelected ? "#0f172a" : "#ffffff", weight: isSelected ? 3 : 1, fillColor: riskColor(tank.risk_level), fillOpacity: 0.8 }}
                eventHandlers={{ click: () => onSelect(tank) }}
              >
                <Tooltip direction="top">{tank.name}</Tooltip>
              </CircleMarker>
            );
          })}
          <FocusTank tank={selectedTank} />
        </MapContainer>
      </div>
    </div>
  );
}
