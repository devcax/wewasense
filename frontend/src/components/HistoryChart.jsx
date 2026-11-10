import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "./format.js";

const NORMAL_BAND_LOW = 0.85;
const NORMAL_BAND_HIGH = 1.15;

function toChartRows(readings) {
  return readings.map((reading) => ({
    date: reading.date,
    fill: reading.fill_percent,
    normal: reading.normal_percent,
    band: [
      Math.round(reading.normal_percent * NORMAL_BAND_LOW * 10) / 10,
      Math.min(100, Math.round(reading.normal_percent * NORMAL_BAND_HIGH * 10) / 10),
    ],
  }));
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-800">{formatDate(label)}</div>
      <div className="text-wewa-700">Fill: {row.fill}%</div>
      <div className="text-slate-500">Normal: {row.normal}%</div>
      <div className="text-slate-400">Normal range: {row.band[0]}–{row.band[1]}%</div>
    </div>
  );
}

function tickDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export default function HistoryChart({ readings }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={toChartRows(readings)} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f5" vertical={false} />
        <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={40} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area dataKey="band" name="Normal range" fill="#bbe6c9" fillOpacity={0.55} stroke="none" isAnimationActive={false} />
        <Line dataKey="normal" name="Normal" stroke="#58b67c" strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
        <Line dataKey="fill" name="Fill %" stroke="#186e9d" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
