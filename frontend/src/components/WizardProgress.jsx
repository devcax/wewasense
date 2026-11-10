import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function WizardProgress({ steps, currentStep }) {
  const progress = (currentStep / (steps.length - 1)) * 100;
  return (
    <div className="mb-6">
      <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-wewa-500 to-paddy-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
      </div>
      <div className="flex justify-between gap-1">
        {steps.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={step} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone ? "bg-paddy-500 text-white" : isCurrent ? "bg-wewa-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone ? <Check size={14} /> : index + 1}
              </span>
              <span className={`hidden text-[11px] font-medium sm:block ${isCurrent ? "text-slate-800" : "text-slate-400"}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
