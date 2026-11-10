import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
const DRIFT_STATUS_COLORS = { ok: "#22a05a", warning: "#f59e0b", alert: "#dc2626" };
const FEATURE_LINE_COLORS = ["#186e9d", "#22a05a", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488"];
const COVERAGE_COLORS = ["#2389bb", "#46a6d3", "#257b49"];
const NO_READING_COLOR = "#cbd5e1";

const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 };

export function CoverageChart({ coverage }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={coverage.by_source} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" vertical={false} />
        <XAxis dataKey="source" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, coverage.total_tanks]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} tanks`, "Tanks"]} cursor={{ fill: "#f1f5f9" }} />
        <ReferenceLine y={coverage.total_tanks} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `All ${coverage.total_tanks} tanks`, fontSize: 10, fill: "#64748b", position: "insideTopRight" }} />
        <Bar dataKey="tanks" radius={[8, 8, 0, 0]} maxBarSize={56}>
          {coverage.by_source.map((row, index) => (
            <Cell key={row.source} fill={row.source === "No valid reading" ? NO_READING_COLOR : COVERAGE_COLORS[index % COVERAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CoverageBySizeChart({ rows }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" vertical={false} />
        <XAxis dataKey="size_class" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="with_reading" name="Valid reading" stackId="coverage" fill="#257b49" maxBarSize={56} />
        <Bar dataKey="without_reading" name="No reading" stackId="coverage" fill="#fca5a5" radius={[8, 8, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DriftScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }
  const feature = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800">{feature.feature_label}</div>
      <div className="text-slate-600">Drift score {feature.drift_score} · PSI {feature.psi_value}</div>
      <div className="text-slate-500">Training seasons: typical PSI {feature.typical_training_psi}, largest {feature.largest_training_psi}</div>
    </div>
  );
}

export function DriftScoreChart({ features, beyondTrainingScore }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={features} layout="vertical" margin={{ top: 16, right: 24, left: 24, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, (dataMax) => Math.max(1.2, Math.ceil(dataMax * 10) / 10)]} />
        <YAxis type="category" dataKey="feature_label" tick={AXIS_TICK} width={150} axisLine={false} tickLine={false} />
        <Tooltip content={<DriftScoreTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <ReferenceLine x={beyondTrainingScore} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Beyond training", fontSize: 10, fill: "#b91c1c", position: "top" }} />
        <Bar dataKey="drift_score" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {features.map((feature) => (
            <Cell key={feature.feature_name} fill={DRIFT_STATUS_COLORS[feature.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DriftHistoryChart({ history, labels, beyondTrainingScore }) {
  const featureNames = Object.keys(labels);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={history} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" vertical={false} />
        <XAxis dataKey="season" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, labels[name] || name]} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => labels[value] || value} />
        <ReferenceLine y={beyondTrainingScore} stroke="#dc2626" strokeDasharray="4 4" />
        {featureNames.map((name, index) => (
          <Line key={name} dataKey={name} stroke={FEATURE_LINE_COLORS[index % FEATURE_LINE_COLORS.length]} dot={{ r: 2 }} strokeWidth={2} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PerformanceChart({ seasons }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={seasons} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" vertical={false} />
        <XAxis dataKey="season" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis yAxisId="fill" unit="%" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis yAxisId="error" orientation="right" unit=" pts" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 30]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="error" dataKey="mean_absolute_error" name="Average error" fill="#e2e8f0" radius={[6, 6, 0, 0]} maxBarSize={24} />
        <Line yAxisId="fill" dataKey="average_actual_fill" name="Actual mid-season fill" stroke="#257b49" strokeWidth={2} dot={{ r: 2 }} />
        <Line yAxisId="fill" dataKey="average_forecast_fill" name="Forecast mid-season fill" stroke="#186e9d" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
