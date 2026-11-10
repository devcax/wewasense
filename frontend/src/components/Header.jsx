import { AlertTriangle } from "lucide-react";
import { useAppSettings } from "./AppSettings.jsx";

export default function Header() {
  const { selectedSeason, backendError } = useAppSettings();

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
      </div>
    </header>
  );
}
