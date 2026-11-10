import { motion } from "framer-motion";

function clampPercent(value) {
  return Math.max(0, Math.min(100, value || 0));
}

export default function FillGauge({ current, forecast, normal }) {
  return (
    <div>
      <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-wewa-200"
          initial={{ width: 0 }}
          animate={{ width: `${clampPercent(forecast)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-wewa-500"
          initial={{ width: 0 }}
          animate={{ width: `${clampPercent(current)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {normal !== null && normal !== undefined && (
          <div className="absolute inset-y-[-2px] w-0.5 bg-slate-800" style={{ left: `${clampPercent(normal)}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-wewa-500" /> Current</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-wewa-200" /> Forecast</span>
        <span className="flex items-center gap-1"><span className="h-2 w-0.5 bg-slate-800" /> Normal mid-season</span>
      </div>
    </div>
  );
}
