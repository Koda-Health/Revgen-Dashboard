"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { VelocityWindow, VelocityTrend } from "@/lib/velocity-analysis";

const OVERALL_KEY = "__overall__";
const OVERALL_COLOR = "#11327A"; // navy
const STAGE_PALETTE = [
  "#34B3D4", "#EE8363", "#4BAC64", "#8B5CF6", "#F59E0B",
  "#0EA5E9", "#EC4899", "#14B8A6", "#A16207", "#64748B",
];

const WINDOWS: { key: VelocityWindow; label: string }[] = [
  { key: "3m", label: "Trailing 3M" },
  { key: "6m", label: "Trailing 6M" },
  { key: "9m", label: "Trailing 9M" },
  { key: "12m", label: "Trailing 12M" },
  { key: "lifetime", label: "Lifetime" },
];

type ChartRow = { label: string } & Record<string, number | string | null>;

type VTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
};
function VelocityTooltip({ active, label, payload }: VTooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-xs ring-1 ring-slate-100 max-w-[240px]">
      <p className="font-semibold text-navy mb-1">{label}</p>
      {rows.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}d</p>
      ))}
    </div>
  );
}

export function PipelineVelocityChart() {
  const [window, setWindow] = useState<VelocityWindow>("3m");
  const [data, setData] = useState<VelocityTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analyzer/velocity?window=${window}`)
      .then((r) => r.json())
      .then((d: VelocityTrend) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [window]);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Which series actually have data across the trend?
  const overallHasData = (data?.points ?? []).some((p) => p.overallCycleDays != null);
  const overallIsFallback = (data?.points ?? []).some((p) => p.overallIsFallback);
  const stageSeries = (data?.stageOrder ?? []).filter((s) =>
    (data?.points ?? []).some((p) => p.stages[s.stage] != null),
  );

  const colorFor = (stage: string) => {
    const idx = (data?.stageOrder ?? []).findIndex((s) => s.stage === stage);
    return STAGE_PALETTE[(idx < 0 ? 0 : idx) % STAGE_PALETTE.length];
  };

  const chartData: ChartRow[] = (data?.points ?? []).map((p) => {
    const row: ChartRow = { label: p.label, [OVERALL_KEY]: p.overallCycleDays };
    for (const s of stageSeries) row[s.stage] = p.stages[s.stage];
    return row;
  });

  const anySeries = overallHasData || stageSeries.length > 0;

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Velocity Trend
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Average days in stage over time (quarterly, {WINDOWS.find((w) => w.key === window)?.label.toLowerCase()} window)
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className={`px-3 py-1.5 border-l first:border-l-0 border-slate-200 ${window === w.key ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {anySeries && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {overallHasData && (
            <button
              onClick={() => toggle(OVERALL_KEY)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${hidden.has(OVERALL_KEY) ? "bg-slate-100 text-slate-400" : "bg-navy/10 text-navy"}`}
            >
              {overallIsFallback ? "Overall Cycle (time in pipeline)" : "Overall Cycle"}
            </button>
          )}
          {stageSeries.map((s) => (
            <button
              key={s.stage}
              onClick={() => toggle(s.stage)}
              style={hidden.has(s.stage) ? undefined : { color: colorFor(s.stage), backgroundColor: colorFor(s.stage) + "1A" }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${hidden.has(s.stage) ? "bg-slate-100 text-slate-400" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading velocity data...</p>
      ) : !anySeries ? (
        <p className="text-sm text-slate-400 text-center py-12">
          No stage-transition history yet. Run an Attio sync to populate it.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `${v}d`}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<VelocityTooltip />} />
            {overallHasData && !hidden.has(OVERALL_KEY) && (
              <Line
                type="monotone"
                dataKey={OVERALL_KEY}
                name={overallIsFallback ? "Overall (time in pipeline)" : "Overall Cycle"}
                stroke={OVERALL_COLOR}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
            {stageSeries.map((s) =>
              hidden.has(s.stage) ? null : (
                <Line
                  key={s.stage}
                  type="monotone"
                  dataKey={s.stage}
                  name={s.label}
                  stroke={colorFor(s.stage)}
                  strokeWidth={1.75}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
