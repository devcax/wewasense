import { RISK_BADGE_CLASSES, STATUS_BADGE_CLASSES } from "./riskStyles.js";

const BADGE_BASE = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset";

export function RiskBadge({ level, size = "sm", emptyLabel = "Unavailable" }) {
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm" : "";
  return <span className={`${BADGE_BASE} ${RISK_BADGE_CLASSES[level] || "bg-slate-100 text-slate-600 ring-slate-200"} ${sizeClass}`}>{level || emptyLabel}</span>;
}

export function StatusBadge({ status, label }) {
  return (
    <span className={`${BADGE_BASE} capitalize ${STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.draft}`}>
      {status === "sending" || status === "queued" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {label || status}
    </span>
  );
}

export function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  const dots = { low: 1, medium: 2, high: 3 }[confidence] || 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600">
      <span className="flex gap-0.5">
        {[1, 2, 3].map((dot) => (
          <span key={dot} className={`h-2 w-2 rounded-full ${dot <= dots ? "bg-wewa-500" : "bg-slate-200"}`} />
        ))}
      </span>
      {confidence}
    </span>
  );
}
