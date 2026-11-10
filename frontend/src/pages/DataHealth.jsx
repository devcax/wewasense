import { motion } from "framer-motion";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { StatusBadge } from "../components/Badges.jsx";
import { CoverageBySizeChart, CoverageChart, DriftHistoryChart, DriftScoreChart, PerformanceChart } from "../components/HealthCharts.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { formatDate } from "../components/format.js";

function Panel({ title, description, children, delay = 0, className = "" }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`card p-5 ${className}`}>
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-xs text-slate-500">{description}</p>}
      {children}
    </motion.section>
  );
}

function SourceCard({ source, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">{source.name}</span>
        <StatusBadge status={source.status} />
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{source.description}</div>
      {source.detail && <div className="mt-2 text-xs text-slate-600">{source.detail}</div>}
      <div className="mt-3 text-sm text-slate-700">{source.last_update ? formatDate(source.last_update) : "No data received"}</div>
      <div className="text-[11px] text-slate-400">
        {source.age_days !== null ? `${source.age_days} days ago · ` : ""}expected every {source.expected_interval_days} days
      </div>
    </motion.div>
  );
}

function DriftTable({ features }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="py-2">Feature</th>
            <th className="py-2 text-right">Training mean</th>
            <th className="py-2 text-right">Current mean</th>
            <th className="py-2 text-right">PSI</th>
            <th className="py-2 text-right">Largest in training</th>
            <th className="py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.feature_name} className="border-b border-slate-50 last:border-0">
              <td className="py-2 font-medium text-slate-700">{feature.feature_label}</td>
              <td className="py-2 text-right text-slate-600">{feature.training_mean}</td>
              <td className="py-2 text-right text-slate-600">{feature.current_mean}</td>
              <td className="py-2 text-right font-semibold text-slate-800">{feature.psi_value.toFixed(2)}</td>
              <td className="py-2 text-right text-slate-600">{feature.largest_training_psi.toFixed(2)}</td>
              <td className="py-2 text-right"><StatusBadge status={feature.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <Skeleton key={item} className="h-72" />
      ))}
    </div>
  );
}

export default function DataHealth() {
  const health = useApiData(() => api.getDataHealth(), []);
  const drift = useApiData(() => api.getDrift(), []);
  const performance = useApiData(() => api.getModelPerformance(), []);
  const isLoading = !health.data || !drift.data || !performance.data;
  const error = health.error || drift.error || performance.error;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <PageHeader
        title="Data health and drift"
        description="Monitor data sources, coverage and model performance."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
            Model version <span className="font-mono font-semibold">{health.data?.model_version || "…"}</span>
          </span>
        }
      />
      {error ? (
        <div role="alert" className="card p-5 text-sm text-red-700">Could not load data health: {error}</div>
      ) : isLoading ? (
        <LoadingGrid />
      ) : (
        <div className="space-y-4">
          <Panel title="Data freshness" description="Fresh: within the expected interval. Late: up to three intervals. Missing: older or not received.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {health.data.sources.map((source, index) => (
                <SourceCard key={source.name} source={source} index={index} />
              ))}
            </div>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Satellite coverage" description={`Tanks with a valid water reading in the last ${health.data.coverage.window_days} days`} delay={0.05}>
              <CoverageChart coverage={health.data.coverage} />
            </Panel>
            <Panel title="Coverage by tank size" description="Satellite readings by tank size" delay={0.1}>
              <CoverageBySizeChart rows={health.data.coverage.by_size_class} />
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={drift.data.latest_season ? `Feature drift · ${drift.data.latest_season}` : "Feature drift"}
              description={drift.data.latest_season ? `Model inputs for ${drift.data.tanks} tanks compared with ${drift.data.reference}. Drift score is PSI divided by the largest PSI between training seasons, so above 1 means more different than any season the model was trained on. Ok: typical for training. Warning: unusual but seen in training. Alert: beyond training.` : "No seasons after the training period yet."}
              delay={0.15}
            >
              {drift.data.features.length > 0 && (
                <>
                  <DriftScoreChart features={drift.data.features} beyondTrainingScore={drift.data.beyond_training_score} />
                  <div className="mt-4">
                    <DriftTable features={drift.data.features} />
                  </div>
                </>
              )}
            </Panel>
            <Panel title="Drift by season" description="Drift score per input for every season since training ended. The red line marks the largest difference seen between training seasons." delay={0.2}>
              <DriftHistoryChart history={drift.data.history} labels={drift.data.feature_labels} beyondTrainingScore={drift.data.beyond_training_score} />
            </Panel>
          </div>
          <Panel
            title="Model performance over past seasons"
            description={`Pre-season model run on seasons it was not trained on (training data ends ${formatDate(performance.data.training_end_date)}). Actual is the average reading in January for Maha and July for Yala. Overall average error ${performance.data.overall_mean_absolute_error ?? "–"} percentage points.`}
            delay={0.25}
          >
            <PerformanceChart seasons={performance.data.seasons} />
          </Panel>
        </div>
      )}
    </div>
  );
}
