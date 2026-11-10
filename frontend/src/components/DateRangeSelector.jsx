const PRESETS = [
  { key: "1y", label: "1 year", years: 1 },
  { key: "3y", label: "3 years", years: 3 },
  { key: "5y", label: "5 years", years: 5 },
  { key: "all", label: "All", years: null },
];

export function presetRange(presetKey) {
  const preset = PRESETS.find((item) => item.key === presetKey);
  if (!preset || preset.years === null) {
    return { start: "", end: "" };
  }
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - preset.years);
  return { start: startDate.toISOString().slice(0, 10), end: "" };
}

export default function DateRangeSelector({ preset, range, onPresetChange, onRangeChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-slate-100 p-1">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            onClick={() => onPresetChange(item.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              preset === item.key ? "bg-white text-wewa-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input type="date" value={range.start} onChange={(event) => onRangeChange({ ...range, start: event.target.value })} className="input w-auto py-1 text-xs" aria-label="Start date" />
      <span className="text-xs text-slate-400">to</span>
      <input type="date" value={range.end} onChange={(event) => onRangeChange({ ...range, end: event.target.value })} className="input w-auto py-1 text-xs" aria-label="End date" />
    </div>
  );
}
