"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Timeframe, VelocityData } from "@/lib/velocity-analysis";

const OVERALL_KEY = "__overall__";
const STAGE_COLOR = "#34B3D4"; // teal
const OVERALL_COLOR = "#11327A"; // navy

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "lifetime", label: "Lifetime" },
  { key: "3m", label: "Trailing 3M" },
  { key: "6m", label: "Trailing 6M" },
  { key: "9m", label: "Trailing 9M" },
  { key: "12m", label: "Trailing 12M" },
];

type Row = { key: string; label: string; days: number; sampleSize: number; isOverall: boolean };

type TooltipProps = { active?: boolean; payload?: Array<{ payload: Row }> };
function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm ring-1 ring-slate-100">
      <p className="font-semibold text-navy mb-1">{d.label}</p>
      <p className="text-teal font-medium">{d.days} days avg</p>
      <p className="text-slate-400 text-xs">n = {d.sampleSize}</p>
    </div>
  );
}

export function PipelineVelocityChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>("lifetime");
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analyzer/velocity?timeframe=${timeframe}`)
      .then((r) => r.json())
      .then((d: VelocityData) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timeframe]);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Series available (only those with data).
  const availableStages = (data?.stages ?? []).filter((s) => s.avgDays != null);
  const hasOverall = data?.overallCycleDays != null;

  const rows: Row[] = [];
  if (hasOverall && !hidden.has(OVERALL_KEY)) {
    rows.push({
      key: OVERALL_KEY,
      label: "Overall Cycle",
      days: data!.overallCycleDays!,
      sampleSize: data!.overallSampleSize,
      isOverall: true,
    });
  }
  for (const s of availableStages) {
    if (hidden.has(s.stage)) continue;
    rows.push({ key: s.stage, label: s.label, days: s.avgDays!, sampleSize: s.sampleSize, isOverall: false });
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Velocity
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Average days in stage (completed transitions) and overall sales cycle
          </p>
        </div>
        {/* Timeframe toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeframe(t.key)}
              className={`px-3 py-1.5 ${timeframe === t.key ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-50"} border-l first:border-l-0 border-slate-200`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series toggles */}
      {(hasOverall || availableStages.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hasOverall && (
            <button
              onClick={() => toggle(OVERALL_KEY)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                hidden.has(OVERALL_KEY) ? "bg-slate-100 text-slate-400" : "bg-navy/10 text-navy"
              }`}
            >
              Overall Cycle
            </button>
          )}
          {availableStages.map((s) => (
            <button
              key={s.stage}
              onClick={() => toggle(s.stage)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                hidden.has(s.stage) ? "bg-slate-100 text-slate-400" : "bg-teal/10 text-teal"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading velocity data...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">
          No completed stage-transition data for this timeframe yet. Run an Attio sync to populate history.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} margin={{ top: 8, right: 0, left: 0, bottom: 8 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={90}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}d`}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(52,179,212,0.08)" }} />
            <Bar dataKey="days" radius={[6, 6, 0, 0]}>
              {rows.map((r) => (
                <Cell key={r.key} fill={r.isOverall ? OVERALL_COLOR : STAGE_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
