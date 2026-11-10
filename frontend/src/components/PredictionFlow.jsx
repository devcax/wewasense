import { motion } from "framer-motion";
import { CloudRain, Satellite, Sprout, TrendingUp } from "lucide-react";
import { formatDate, formatPercent, sourceLabel } from "./format.js";

function buildSteps(tank) {
  const signals = tank.signals || {};
  return [
    {
      icon: Satellite,
      title: "Satellite water reading",
      color: "bg-wewa-50 text-wewa-600",
      lines: [
        `Fill ${formatPercent(tank.current_fill_percent, 1)}`,
        `${sourceLabel(tank.last_reading_source)} · ${formatDate(tank.last_reading_date)}`,
      ],
    },
    {
      icon: CloudRain,
      title: "Model inputs",
      color: "bg-sky-50 text-sky-600",
      lines: [
        `Fill at planting ${formatPercent(signals.fill_at_planting_percent, 1)} · ${formatDate(signals.planting_date)}`,
        `Rain ${signals.rain_30d_mm ?? "–"} mm (30 days) · ${signals.rain_60d_mm ?? "–"} mm (60 days)`,
        signals.inputs_from_season ? `Inputs from ${signals.inputs_from_season}${signals.is_demo ? " (demo)" : ""}` : "No model inputs for this tank",
      ],
    },
    {
      icon: TrendingUp,
      title: "Forecast",
      color: "bg-indigo-50 text-indigo-600",
      lines: [
        `Mid-season ${formatPercent(tank.forecast_mid_season_fill_percent, 1)}`,
        `Normal ${formatPercent(tank.normal_mid_season_fill_percent, 1)}`,
        `Risk ${tank.risk_level} · ${tank.confidence} confidence`,
      ],
    },
    {
      icon: Sprout,
      title: "Planting plan",
      color: "bg-paddy-50 text-paddy-600",
      lines: [
        `Cultivate ${formatPercent(tank.plan?.percent_to_cultivate)}`,
        `Safe area ${tank.plan?.safe_area_ha ?? "–"} ha`,
        tank.plan?.bethma ? "Bethma recommended" : "No bethma needed",
      ],
    },
  ];
}

function Connector({ index }) {
  return (
    <div className="relative hidden h-0.5 w-10 shrink-0 self-center overflow-hidden rounded bg-slate-100 lg:block">
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-wewa-400 to-paddy-400"
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ delay: 0.3 + index * 0.35, duration: 0.4 }}
      />
      <motion.span
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-wewa-500"
        animate={{ left: ["0%", "100%"] }}
        transition={{ delay: 1.6, duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function Step({ step, index }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.35, duration: 0.35 }}
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 lg:w-auto lg:min-w-0 lg:flex-1"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-xl p-2 ${step.color}`}>
          <Icon size={18} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</span>
      </div>
      <div className="text-sm font-semibold text-slate-800">{step.title}</div>
      <div className="mt-1 space-y-0.5">
        {step.lines.map((line) => (
          <div key={line} className="text-xs text-slate-500">
            {line}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PredictionFlow({ tank }) {
  const steps = buildSteps(tank);
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
      {steps.map((step, index) => (
        <div key={step.title} className="contents">
          <Step step={step} index={index} />
          {index < steps.length - 1 && <Connector index={index} />}
        </div>
      ))}
    </div>
  );
}
