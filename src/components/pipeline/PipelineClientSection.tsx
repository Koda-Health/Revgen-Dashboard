"use client";

import { useState, useMemo } from "react";
import { PipelineKpiStrip } from "@/components/pipeline/PipelineKpiStrip";
import { PipelineBarCharts } from "@/components/pipeline/PipelineBarCharts";
import { InteractiveBreakdown } from "@/components/pipeline/InteractiveBreakdown";
import type { PipelineData } from "@/lib/pipeline-data";
import type { DealRow } from "@/components/ui/DealTable";

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = ["All", currentYear - 1, currentYear, currentYear + 1, currentYear + 2] as const;

function deriveFilteredData(data: PipelineData, yearFilter: string): PipelineData {
  if (yearFilter === "All") return data;

  const year = parseInt(yearFilter, 10);
  const filtered = data.activeDeals.filter((d) => {
    if (!d.expectedClosedDate) return false;
    return new Date(d.expectedClosedDate).getFullYear() === year;
  });

  const pipelineTotal = filtered.reduce((s, d) => s + (d.value ?? 0), 0);
  const activeDealCount = filtered.length;
  const avgDealSize = activeDealCount > 0 ? pipelineTotal / activeDealCount : 0;

  // Weighted forecast from filtered deals
  const rateMap = new Map(data.stageAssumptions.map((a) => [a.stage, a.overallCloseRate]));
  const weightedForecast = filtered
    .filter((d) => d.stage)
    .reduce((sum, d) => sum + (d.value ?? 0) * (rateMap.get(d.stage!) ?? 0), 0);

  // Recompute breakdowns
  function buildBreakdown(key: keyof DealRow) {
    const map: Record<string, { value: number; count: number }> = {};
    for (const deal of filtered) {
      const k = String(deal[key] ?? "unknown");
      if (!map[k]) map[k] = { value: 0, count: 0 };
      map[k].value += deal.value ?? 0;
      map[k].count += 1;
    }
    return Object.entries(map).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.value - a.value);
  }

  return {
    ...data,
    pipelineTotal,
    activeDealCount,
    avgDealSize,
    weightedForecast,
    byStage:       buildBreakdown("stage"),
    bySource:      buildBreakdown("source"),
    byDealType:    buildBreakdown("typeOfDeal"),
    byCompanyType: buildBreakdown("companyType"),
    activeDeals:   filtered,
  };
}

export function PipelineClientSection({
  data,
  variant = "new_logo",
}: {
  data: PipelineData;
  variant?: "new_logo" | "renewal";
}) {
  const [yearFilter, setYearFilter] = useState("All");

  const filteredData = useMemo(() => deriveFilteredData(data, yearFilter), [data, yearFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Expected Close Year:
        </label>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={String(y)} value={String(y)}>{String(y)}</option>
          ))}
        </select>
        {yearFilter !== "All" && (
          <button
            onClick={() => setYearFilter("All")}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>
      <PipelineKpiStrip data={filteredData} variant={variant} />
      <PipelineBarCharts data={filteredData} variant={variant} />
      <InteractiveBreakdown deals={filteredData.activeDeals} />
    </div>
  );
}
