import { AnimatePresence, motion } from "framer-motion";
import { Droplets, MapPin, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ConfidenceBadge, RiskBadge } from "./Badges.jsx";
import FillGauge from "./FillGauge.jsx";
import { formatDate, formatNumber, formatPercent, sourceLabel, unavailableForecastLabel } from "./format.js";

function PanelStat({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1 break-words text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function PanelContent({ tank, view, seasonLabel, onClose }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-wewa-600">{seasonLabel}</div>
          <h2 className="mt-1 break-words text-lg font-bold text-slate-900">{tank.name}</h2>
          {tank.name !== tank.tank_id && <div className="mt-1 flex items-center gap-1 break-all text-xs text-slate-500">
            <MapPin size={12} /> {tank.tank_id}
          </div>}
        </div>
        <button onClick={onClose} className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close tank details">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div><div className="mb-1 text-xs text-slate-500">{view === "current" ? "Current risk" : "Forecast risk"}</div><RiskBadge level={view === "current" ? tank.current_risk_level : tank.risk_level} emptyLabel={view === "current" ? "Unavailable" : unavailableForecastLabel(tank)} size="lg" /></div>
          <ConfidenceBadge confidence={tank.confidence} />
        </div>
        <FillGauge
          current={tank.current_fill_percent}
          forecast={tank.forecast_mid_season_fill_percent}
          normal={tank.normal_mid_season_fill_percent}
        />
        <div className="grid grid-cols-2 gap-2">
          <PanelStat label="Current fill" value={formatPercent(tank.current_fill_percent)} />
          <PanelStat label="Normal now" value={formatPercent(tank.current_normal_percent)} />
          <PanelStat label="Forecast mid-season" value={formatPercent(tank.forecast_mid_season_fill_percent)} />
          <PanelStat label="Normal mid-season" value={formatPercent(tank.normal_mid_season_fill_percent)} />
          <PanelStat label="Area" value={`${formatNumber(tank.area_ha, 1)} ha`} />
          <PanelStat label="Organizations" value={tank.organization_count} />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-wewa-50 p-3 text-xs text-wewa-800">
          <Droplets size={16} className="shrink-0" />
          {tank.last_reading_date ? `Last reading ${formatDate(tank.last_reading_date)} from ${sourceLabel(tank.last_reading_source)}` : "No water readings available"}
        </div>
      </div>
      <div className="border-t border-slate-100 p-5">
        <Link to={`/tanks/${encodeURIComponent(tank.tank_id)}`} className="btn-primary w-full">
          View details
        </Link>
      </div>
    </>
  );
}

export default function TankSidePanel({ tank, view, seasonLabel, onClose }) {
  return (
    <AnimatePresence>
      {tank && (
        <motion.aside
          key="tank-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-3 left-3 right-3 z-[460] flex max-h-[70%] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:top-4 sm:max-h-none sm:w-[340px]"
        >
          <PanelContent tank={tank} view={view} seasonLabel={seasonLabel} onClose={onClose} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
