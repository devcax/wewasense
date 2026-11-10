import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter.jsx";
import { Skeleton } from "./Skeleton.jsx";

function SummaryCard({ label, value, footer, index, active, onClick }) {
  const Element = onClick ? motion.button : motion.div;
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`card w-full min-w-[150px] p-3 text-left ${onClick ? "transition hover:bg-slate-50" : ""} ${active ? "ring-2 ring-wewa-400" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {footer && <div className="text-[11px] text-slate-500">{footer}</div>}
    </Element>
  );
}

export default function SummaryCards({ summary, riskFilter, onRiskFilter, viewLabel }) {
  if (!summary) {
    return (
      <div className="flex gap-2 lg:flex-col">
        {[1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-[84px] w-[150px] lg:w-full" />
        ))}
      </div>
    );
  }
  const difference = (summary.average_fill_percent || 0) - (summary.average_normal_percent || 0);
  const toggle = (level) => onRiskFilter(riskFilter === level ? "ALL" : level);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      <SummaryCard index={0} label="Total tanks" value={<AnimatedCounter value={summary.total_tanks} />} footer={`${summary.large_reservoirs} large reservoirs`} active={riskFilter === "ALL"} onClick={() => onRiskFilter("ALL")} />
      <SummaryCard index={1} label="High risk" value={<AnimatedCounter value={summary.risk_counts.HIGH} />} footer={viewLabel} active={riskFilter === "HIGH"} onClick={() => toggle("HIGH")} />
      <SummaryCard index={2} label="Medium risk" value={<AnimatedCounter value={summary.risk_counts.MEDIUM} />} footer={viewLabel} active={riskFilter === "MEDIUM"} onClick={() => toggle("MEDIUM")} />
      <SummaryCard index={3} label="Low risk" value={<AnimatedCounter value={summary.risk_counts.LOW} />} footer={viewLabel} active={riskFilter === "LOW"} onClick={() => toggle("LOW")} />
      <SummaryCard
        index={4}
        label="Average fill"
        value={summary.average_fill_percent == null ? "–" : <AnimatedCounter value={summary.average_fill_percent} decimals={1} suffix="%" />}
        footer={summary.average_fill_percent == null ? "No readings available" : summary.average_normal_percent == null ? "Normal unavailable" : `Normal ${summary.average_normal_percent}% · ${difference >= 0 ? "+" : ""}${difference.toFixed(1)} pts`}
      />
    </div>
  );
}
