import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { useAppSettings } from "../components/AppSettings.jsx";
import MapLegend from "../components/MapLegend.jsx";
import MapToolbar from "../components/MapToolbar.jsx";
import SummaryCards from "../components/SummaryCards.jsx";
import TankMarkers, { displayedRisk } from "../components/TankMarkers.jsx";
import TankSidePanel from "../components/TankSidePanel.jsx";

const ANURADHAPURA_CENTER = [8.38, 80.5];

function FlyToTank({ tank }) {
  const map = useMap();
  useEffect(() => {
    if (tank) {
      map.flyTo([tank.center_lat, tank.center_lon], Math.max(map.getZoom(), 11), { duration: 0.8 });
    }
  }, [tank?.tank_id]);
  return null;
}

function filterByRisk(tanks, riskFilter, view) {
  if (riskFilter === "ALL") {
    return tanks;
  }
  return tanks.filter((tank) => displayedRisk(tank, view) === riskFilter);
}

function sortLargeFirst(tanks) {
  return [...tanks].sort((first, second) => second.area_ha - first.area_ha);
}

export default function TankMap() {
  const { seasonKey, selectedSeason } = useAppSettings();
  const [view, setView] = useState("forecast");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedTankId, setSelectedTankId] = useState(null);

  const tanksData = useApiData(() => api.getTanks(seasonKey, view), [seasonKey, view]);
  const summaryData = useApiData(() => api.getSummary(seasonKey, view), [seasonKey, view]);

  useEffect(() => {
    if (tanksData.error) {
      toast.error(`Could not load tanks: ${tanksData.error}`);
    }
  }, [tanksData.error]);

  const tanks = tanksData.data?.tanks || [];
  const visibleTanks = useMemo(() => sortLargeFirst(filterByRisk(tanks, riskFilter, view)), [tanks, riskFilter, view]);
  const selectedTank = tanks.find((tank) => tank.tank_id === selectedTankId) || null;
  const season = tanksData.data?.season || summaryData.data?.season;
  const viewLabel = view === "forecast" ? season?.forecast_label || "Forecast" : season?.current_label || "Water now";
  const showForecastUnavailable = view === "forecast" && season && !season.forecast_available;

  return (
    <div className="flex h-full min-h-[560px] flex-col bg-slate-100">
      <div className="relative z-[500] shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
        <MapToolbar
          tanks={tanks}
          view={view}
          season={season}
          onViewChange={setView}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          onSelectTank={(tank) => setSelectedTankId(tank.tank_id)}
          loading={tanksData.loading && Boolean(tanksData.data)}
        />
      </div>
      <div className="relative min-h-0 flex-1">
      <MapContainer center={ANURADHAPURA_CENTER} zoom={10} minZoom={8} className="h-full w-full" zoomControl={false} preferCanvas={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TankMarkers tanks={visibleTanks} view={view} selectedTankId={selectedTankId} onSelect={(tank) => setSelectedTankId(tank.tank_id)} />
        <FlyToTank tank={selectedTank} />
      </MapContainer>

      <div className={`pointer-events-none absolute inset-x-3 bottom-3 z-[450] sm:inset-x-4 sm:bottom-4 lg:inset-auto lg:left-4 lg:top-4 lg:w-[190px] ${selectedTank ? "hidden" : ""}`}>
        <div className="pointer-events-auto">
          <SummaryCards summary={summaryData.data} riskFilter={riskFilter} onRiskFilter={setRiskFilter} viewLabel={viewLabel} />
        </div>
      </div>

      {showForecastUnavailable && (
        <div role="status" className="absolute inset-x-3 top-3 z-[460] mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg sm:top-4">
          <div className="font-semibold">No forecast for {season.label} yet</div>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">{season.forecast_unavailable_reason}</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-[450] hidden lg:block">
        <MapLegend />
      </div>

      <TankSidePanel tank={selectedTank} view={view} seasonLabel={selectedSeason?.display} onClose={() => setSelectedTankId(null)} />
      </div>
    </div>
  );
}
