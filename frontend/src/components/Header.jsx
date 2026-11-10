import { AlertTriangle, FlaskConical } from "lucide-react";
import { useAppSettings } from "./AppSettings.jsx";

function MockDataBadge({ modelVersion }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
      title="Forecasts come from the mock prediction service"
    >
      <FlaskConical size={13} />
      Mock data · {modelVersion}
    </span>
  );
}

export default function Header() {
  const { meta, selectedSeason, backendError } = useAppSettings();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-800">Tank water and season planning</div>
        <div className="truncate text-xs text-slate-500">Anuradhapura district · {selectedSeason?.display}</div>
      </div>
      <div className="flex items-center gap-2">
        {backendError && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={13} /> Backend not reachable
          </span>
        )}
        {meta?.uses_mock_predictions && <MockDataBadge modelVersion={meta.model_version} />}
      </div>
    </header>
  );
}
