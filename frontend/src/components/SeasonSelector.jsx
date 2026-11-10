import { CalendarRange, ChevronDown } from "lucide-react";
import { useAppSettings } from "./AppSettings.jsx";

export default function SeasonSelector({ className = "" }) {
  const { seasons, seasonKey, setSeasonKey } = useAppSettings();

  return (
    <div className={`relative ${className}`}>
      <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wewa-600" />
      <select
        value={seasonKey}
        onChange={(event) => setSeasonKey(event.target.value)}
        className="input appearance-none py-2 pl-9 pr-8 font-medium"
        aria-label="Season"
      >
        {seasons.map((season) => (
          <option key={season.key} value={season.key}>
            {season.display}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  );
}
