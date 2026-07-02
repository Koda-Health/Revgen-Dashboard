"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatPct } from "@/lib/format";
import type { WaterfallStage } from "@/lib/dashboard-data";

const STEP_COLOR = "#34B3D4"; // teal
const TOTAL_COLOR = "#11327A"; // navy

type ChartRow = {
  label: string;
  base: number;
  step: number;
  pipeline: number;
  closeRate: number;
  weighted: number;
  cumulative: number;
  isTotal: boolean;
};

type TooltipProps = { active?: boolean; payload?: Array<{ payload: ChartRow }> };

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm ring-1 ring-slate-100">
      <p className="font-semibold text-navy mb-1">{d.label}</p>
      {d.isTotal ? (
        <p className="text-navy font-medium">{formatCurrency(d.weighted)} total weighted pipeline</p>
      ) : (
        <>
          <p className="text-slate-500 text-xs">{formatCurrency(d.pipeline)} pipeline</p>
          <p className="text-slate-500 text-xs">{formatPct(d.closeRate)} close rate</p>
          <p className="text-teal font-medium">+{formatCurrency(d.weighted)} weighted</p>
          <p className="text-slate-400 text-xs mt-0.5">{formatCurrency(d.cumulative)} cumulative</p>
        </>
      )}
    </div>
  );
}

export function RevenueWaterfall({ data }: { data: WaterfallStage[] }) {
  const total = data.length ? data[data.length - 1].cumulative : 0;

  const chartData: ChartRow[] = [
    ...data.map((d) => ({
      label: d.label,
      base: d.cumulative - d.weighted,
      step: d.weighted,
      pipeline: d.pipeline,
      closeRate: d.closeRate,
      weighted: d.weighted,
      cumulative: d.cumulative,
      isTotal: false,
    })),
    {
      label: "Total",
      base: 0,
      step: total,
      pipeline: total,
      closeRate: 1,
      weighted: total,
      cumulative: total,
      isTotal: true,
    },
  ];

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="mb-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Weighted Pipeline by Stage
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Each stage&rsquo;s weighted contribution (pipeline × close rate) building to total weighted new-logo pipeline
        </p>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 8 }}>
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
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(52,179,212,0.08)" }} />
          {/* transparent base lifts each step to its cumulative position */}
          <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="step" stackId="wf" radius={[6, 6, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={entry.isTotal ? TOTAL_COLOR : STEP_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
