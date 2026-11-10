import { LARGE_RESERVOIR_COLOR, RISK_COLORS } from "./riskStyles.js";

export default function MapLegend() {
  return (
    <div className="card space-y-1 px-3 py-2 text-[11px] text-slate-600">
      {Object.entries(RISK_COLORS).map(([level, color]) => (
        <div key={level} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          {level}
        </div>
      ))}
      <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400" />Unavailable</div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-2 border-dashed" style={{ borderColor: LARGE_RESERVOIR_COLOR }} />
        Large reservoir
      </div>
      <div className="pt-1 text-slate-400">Circle size = tank area</div>
    </div>
  );
}
