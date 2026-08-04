// src/components/analyzer/CohortWaterfall.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { formatCurrency, formatDelta, formatPct } from "@/lib/format";
import { ExportButton } from "@/components/ui/ExportButton";
import { CohortBucketModal } from "./CohortBucketModal";
import type { CohortAnalysisResult, CohortRow, BucketDeal } from "@/lib/cohort-analysis";

const CATEGORY_META: Record<CohortRow["category"], { label: string; colorClass: string }> = {
  closed_won:  { label: "Closed Won",       colorClass: "bg-emerald-100 text-emerald-700" },
  closed_lost: { label: "Closed Lost",      colorClass: "bg-red-100 text-red-700" },
  advanced:    { label: "Advanced",         colorClass: "bg-teal/10 text-[#34B3D4]" },
  held:        { label: "Held / Same Stage",colorClass: "bg-gray-100 text-gray-600" },
  regressed:   { label: "Regressed",        colorClass: "bg-orange-100 text-orange-700" },
  not_found:   { label: "Not Found",        colorClass: "bg-gray-100 text-gray-400" },
};

const CATEGORY_ORDER: CohortRow["category"][] = [
  "closed_won", "advanced", "held", "regressed", "closed_lost", "not_found",
];

type Props = {
  manifestIdA: string;
  manifestIdB: string;
};

type ActiveBucket = {
  title: string;
  deals: BucketDeal[];
  showStageA: boolean;
  showStageB: boolean;
};

export function CohortWaterfall({ manifestIdA, manifestIdB }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CohortAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveBucket | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setActive(null);
    fetch(`/api/analyzer/cohort?manifestA=${manifestIdA}&manifestB=${manifestIdB}`)
      .then((r) => r.json())
      .then((j: unknown) => {
        const json = j as { error?: string } & Partial<CohortAnalysisResult>;
        if (json.error) throw new Error(json.error);
        setData(json as CohortAnalysisResult);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [manifestIdA, manifestIdB]);

  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-card p-6 text-sm text-slate-400">
        Loading cohort data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-card shadow-card p-6 text-sm text-red-500">{error}</div>
    );
  }
  if (!data) return null;

  const rowMap = new Map(data.cohortRows.map((r) => [r.category, r]));
  const dateA = new Date(data.snapshotAtA).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const dateB = new Date(data.snapshotAtB).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  function openWaterfallBucket(cat: CohortRow["category"], deals: BucketDeal[]) {
    if (deals.length === 0) return;
    setActive({
      title: `${CATEGORY_META[cat].label} — ${deals.length} deals`,
      deals,
      showStageA: true,
      showStageB: cat !== "not_found",
    });
  }

  function openFlowBucket(label: string, deals: BucketDeal[], opts: { showStageA: boolean }) {
    if (deals.length === 0) return;
    setActive({
      title: `${label} — ${deals.length} deals`,
      deals,
      showStageA: opts.showStageA,
      showStageB: true,
    });
  }

  return (
    <div ref={outerRef} className="space-y-4">
      {/* Cohort waterfall table */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Cohort: Active Pipeline at {dateA} → Status at {dateB}
          </h3>
          <ExportButton getElement={() => outerRef.current} filename="cohort-waterfall" variant="icon" />
        </div>
        <div className="flex flex-wrap gap-8 mb-6">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Cohort Size
            </p>
            <p className="text-xl font-bold text-navy">{data.cohortTotal} deals</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Cohort Value at {dateA}
            </p>
            <p className="text-xl font-bold text-navy">
              {formatCurrency(data.cohortTotalValue)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-5 py-3 pr-4">Outcome</th>
                <th className="px-5 py-3 pr-4 text-right">Deals</th>
                <th className="px-5 py-3 pr-4 text-right">Value ({dateB})</th>
                <th className="px-5 py-3 text-right">% of Cohort</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const row = rowMap.get(cat) ?? { category: cat, dealCount: 0, totalValueA: 0, totalValueB: 0, deals: [] };
                const meta = CATEGORY_META[cat];
                const pct = data.cohortTotal > 0 ? row.dealCount / data.cohortTotal : 0;
                const clickable = row.dealCount > 0;
                const delta = row.totalValueB - row.totalValueA;
                const deltaFmt = formatDelta(delta);
                return (
                  <tr
                    key={cat}
                    onClick={clickable ? () => openWaterfallBucket(cat, row.deals) : undefined}
                    className={`border-b border-slate-100 last:border-0 even:bg-slate-50/40 transition-colors ${
                      clickable ? "cursor-pointer hover:bg-teal/5" : ""
                    }`}
                  >
                    <td className="px-5 py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.colorClass}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 pr-4 text-right font-semibold text-navy tabular-nums">
                      {row.dealCount}
                    </td>
                    <td className="px-5 py-3 pr-4 text-right tabular-nums">
                      <div className="font-semibold text-navy">{formatCurrency(row.totalValueB)}</div>
                      <div className="text-[11px] text-slate-400">
                        {cat === "not_found" ? (
                          <>value as of {dateA} — dropped from pipeline</>
                        ) : (
                          <>
                            was {formatCurrency(row.totalValueA)} at {dateA}
                            {delta !== 0 && (
                              <span className={deltaFmt.positive ? "text-emerald-600" : "text-coral"}>
                                {" "}({deltaFmt.display})
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">{formatPct(pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flow metrics */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          Pipeline Flow: {dateA} → {dateB}
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            disabled={data.flowMetrics.newDeals === 0}
            onClick={() =>
              openFlowBucket("New Pipeline", data.flowMetrics.newDealsList, { showStageA: false })
            }
            className={`text-left bg-slate-50 rounded-card p-4 border border-slate-200 transition-colors ${
              data.flowMetrics.newDeals > 0 ? "cursor-pointer hover:bg-teal/5" : "cursor-default opacity-90"
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              New Pipeline
            </p>
            <p className="text-xl font-bold text-navy">
              {data.flowMetrics.newDeals} deals
            </p>
            <p className="text-xs text-slate-500">{formatCurrency(data.flowMetrics.newValue)}</p>
          </button>

          <button
            type="button"
            disabled={data.flowMetrics.wonDeals === 0}
            onClick={() =>
              openFlowBucket("Won", data.flowMetrics.wonDealsList, { showStageA: true })
            }
            className={`text-left bg-emerald-50/70 rounded-card p-4 border border-emerald-100 transition-colors ${
              data.flowMetrics.wonDeals > 0 ? "cursor-pointer hover:bg-emerald-100/60" : "cursor-default opacity-90"
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Won
            </p>
            <p className="text-xl font-bold text-emerald-700">
              {data.flowMetrics.wonDeals} deals
            </p>
            <p className="text-xs text-slate-500">{formatCurrency(data.flowMetrics.wonValue)}</p>
          </button>

          <button
            type="button"
            disabled={data.flowMetrics.lostDeals === 0}
            onClick={() =>
              openFlowBucket("Lost", data.flowMetrics.lostDealsList, { showStageA: true })
            }
            className={`text-left bg-red-50/70 rounded-card p-4 border border-red-100 transition-colors ${
              data.flowMetrics.lostDeals > 0 ? "cursor-pointer hover:bg-red-100/60" : "cursor-default opacity-90"
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Lost
            </p>
            <p className="text-xl font-bold text-red-600">
              {data.flowMetrics.lostDeals} deals
            </p>
            <p className="text-xs text-slate-500">{formatCurrency(data.flowMetrics.lostValue)}</p>
          </button>

          <div className="bg-slate-50 rounded-card p-4 border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Pipeline Upside <span className="normal-case font-normal text-slate-400">(Retained Deals)</span>
            </p>
            <p
              className={`text-xl font-bold ${
                data.flowMetrics.pipelineUpside >= 0 ? "text-emerald-700" : "text-coral"
              }`}
            >
              {formatDelta(data.flowMetrics.pipelineUpside).display}
            </p>
            <p className="text-xs text-slate-500">
              Value change on deals still active in pipeline (not new, won, or lost)
            </p>
          </div>

          <div className="bg-slate-50 rounded-card p-4 border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Net Pipeline Change
            </p>
            <p
              className={`text-xl font-bold ${
                data.flowMetrics.netPipelineChange >= 0 ? "text-emerald-700" : "text-coral"
              }`}
            >
              {data.flowMetrics.netPipelineChange >= 0 ? "+" : ""}
              {formatCurrency(data.flowMetrics.netPipelineChange)}
            </p>
          </div>
        </div>
      </div>

      <CohortBucketModal
        open={active !== null}
        onClose={() => setActive(null)}
        title={active?.title ?? ""}
        deals={active?.deals ?? []}
        showStageA={active?.showStageA ?? true}
        showStageB={active?.showStageB ?? true}
      />
    </div>
  );
}
