export const RISK_COLORS = {
  LOW: "#22a05a",
  MEDIUM: "#f59e0b",
  HIGH: "#dc2626",
};

export const LARGE_RESERVOIR_COLOR = "#64748b";

export const RISK_BADGE_CLASSES = {
  LOW: "bg-green-50 text-green-700 ring-green-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-red-50 text-red-700 ring-red-200",
};

export const STATUS_BADGE_CLASSES = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  approved: "bg-wewa-50 text-wewa-700 ring-wewa-200",
  sending: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  sent: "bg-green-50 text-green-700 ring-green-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  queued: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  received: "bg-green-50 text-green-700 ring-green-200",
  unparsed: "bg-amber-50 text-amber-700 ring-amber-200",
  fresh: "bg-green-50 text-green-700 ring-green-200",
  late: "bg-amber-50 text-amber-700 ring-amber-200",
  missing: "bg-red-50 text-red-700 ring-red-200",
  ok: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  alert: "bg-red-50 text-red-700 ring-red-200",
};

export function riskColor(riskLevel) {
  return RISK_COLORS[riskLevel] || "#94a3b8";
}
