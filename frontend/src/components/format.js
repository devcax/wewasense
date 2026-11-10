export function formatPercent(value, decimals = 0) {
  if (value === null || value === undefined) {
    return "–";
  }
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) {
    return "–";
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function formatDate(value) {
  if (!value) {
    return "–";
  }
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) {
    return "–";
  }
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sourceLabel(source) {
  return { sentinel1: "Sentinel-1", sentinel2: "Sentinel-2" }[source] || source || "–";
}

export const LANGUAGE_LABELS = { si: "Sinhala", ta: "Tamil", en: "English" };
export const CHANNEL_LABELS = { sms: "SMS", whatsapp: "WhatsApp" };

export function unavailableForecastLabel(tank) {
  return tank.forecast_status === "too_small" ? "Too small to forecast" : "Unavailable";
}

export function demoInputsLabel(tank) {
  return tank.forecast_status === "demo" ? `Demo inputs: ${tank.forecast_inputs_label}` : null;
}
