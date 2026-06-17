"use client";

import { useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, SOURCE_LABELS, DEAL_TYPE_LABELS } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/stages";
import { Modal } from "@/components/ui/Modal";
import { DealTable } from "@/components/ui/DealTable";
import { ExportButton } from "@/components/ui/ExportButton";
import type { DealRow } from "@/components/ui/DealTable";

type GroupKey = "stage" | "source" | "typeOfDeal";

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "stage",      label: "Stage" },
  { value: "source",     label: "Source" },
  { value: "typeOfDeal", label: "Deal Type" },
];

const LABEL_MAPS: Record<GroupKey, Record<string, string>> = {
  stage:      STAGE_LABELS,
  source:     SOURCE_LABELS,
  typeOfDeal: DEAL_TYPE_LABELS,
};

const BAR_COLORS = ["#34B3D4", "#EE8363", "#4BAC64", "#11327A", "#CCECF4", "#9CA3AF"];

type DrillDown = { title: string; deals: DealRow[] } | null;

export function InteractiveBreakdown({ deals }: { deals: DealRow[] }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [groupBy, setGroupBy]         = useState<GroupKey>("stage");
  const [breakdownBy, setBreakdownBy] = useState<GroupKey | "none">("none");
  const [drillDown, setDrillDown]     = useState<DrillDown>(null);

  // Build chart data
  const groupMap: Record<string, Record<string, number>> = {};
  const breakdownKeys = new Set<string>();

  for (const deal of deals) {
    const gKey = String(deal[groupBy] ?? "unknown");
    const bKey =
      breakdownBy === "none"
        ? "__value__"
        : String((deal[breakdownBy as keyof DealRow] as string | null) ?? "unknown");
    if (!groupMap[gKey]) groupMap[gKey] = {};
    groupMap[gKey][bKey] = (groupMap[gKey][bKey] ?? 0) + (deal.value ?? 0);
    breakdownKeys.add(bKey);
  }

  const groupLabels = LABEL_MAPS[groupBy];
  const brkLabels   = breakdownBy !== "none" ? LABEL_MAPS[breakdownBy as GroupKey] : {};

  const chartData = Object.entries(groupMap).map(([key, values]) => ({
    name: groupLabels[key] ?? key,
    _rawKey: key, // preserve for drill-down filtering
    ...values,
  }));

  const barKeys = breakdownBy === "none" ? ["__value__"] : Array.from(breakdownKeys);

  // Drill-down: when a bar is clicked, filter deals by the group key
  function handleBarClick(entry: Record<string, unknown>) {
    const rawKey = entry._rawKey as string;
    const filtered = deals.filter((d) => String(d[groupBy] ?? "unknown") === rawKey);
    const title = groupLabels[rawKey] ?? rawKey;
    setDrillDown({ title, deals: filtered });
  }

  return (
    <>
      <div ref={cardRef} className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Breakdown
          </h2>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <ExportButton getElement={() => cardRef.current} filename="pipeline-breakdown" variant="icon" />
            <label className="flex items-center gap-2">
              Group by:
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupKey)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
              >
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Break down by:
              <select
                value={breakdownBy}
                onChange={(e) => setBreakdownBy(e.target.value as GroupKey | "none")}
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
              >
                <option value="none">None</option>
                {GROUP_OPTIONS.filter((o) => o.value !== groupBy).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              cursor={{ fill: "rgba(52,179,212,0.08)" }}
              contentStyle={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#11327A", fontWeight: 600 }}
              formatter={(value: unknown, name: unknown) => {
                const nameStr = String(name ?? "");
                return [
                  formatCurrency(Number(value ?? 0)),
                  nameStr === "__value__" ? "Pipeline" : (brkLabels[nameStr] ?? nameStr),
                ] as [string, string];
              }}
            />
            {breakdownBy !== "none" && <Legend />}
            {barKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                radius={i === barKeys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                name={key === "__value__" ? "Pipeline" : (brkLabels[key] ?? key)}
                cursor="pointer"
                onClick={(entry: unknown) => handleBarClick(entry as Record<string, unknown>)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Modal
        open={drillDown != null}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title ?? ""}
        width="xl"
      >
        {drillDown && <DealTable deals={drillDown.deals} />}
      </Modal>
    </>
  );
}
