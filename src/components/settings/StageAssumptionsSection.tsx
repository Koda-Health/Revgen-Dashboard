// src/components/settings/StageAssumptionsSection.tsx
"use client";

import { useMemo, useState } from "react";
import { deriveCloseRates, ACTIVE_STAGE_ORDER } from "@/lib/close-rate";

type AssumptionRow = {
  stage: string;
  overallCloseRate: number; // materialized effective rate (server-computed)
  closeRateOverride: number | null; // manual pin; null = use derived
  conversionToNext: number;
  avgDaysInStage: number;
};

type Props = {
  initialRows: AssumptionRow[];
};

const STAGE_LABELS: Record<string, string> = {
  first_convo:  "First Conversation",
  opp_qual:     "Opp Qualification",
  stakeholder:  "Stakeholder Buy-In",
  verbal:       "Verbal Commit",
  contracting:  "Contracting",
  closed_won:   "Closed Won",
  lost:         "Lost",
};

const STAGE_ORDER = ["first_convo", "opp_qual", "stakeholder", "verbal", "contracting", "closed_won", "lost"];
const ACTIVE_STAGES = new Set<string>(ACTIVE_STAGE_ORDER);

export function StageAssumptionsSection({ initialRows }: Props) {
  const sorted = [...initialRows].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  );
  const [rows, setRows] = useState<AssumptionRow[]>(sorted);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Live-derived close rate per active stage from the current conversion rates.
  const derived = useMemo(
    () => deriveCloseRates(rows.map((r) => ({ stage: r.stage, conversionToNext: r.conversionToNext }))),
    [rows]
  );

  function handleChange(stage: string, field: "conversionToNext" | "avgDaysInStage", value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.stage === stage
          ? { ...r, [field]: field === "avgDaysInStage" ? parseInt(value) || 0 : parseFloat(value) || 0 }
          : r
      )
    );
  }

  function handleOverrideChange(stage: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.stage === stage
          ? { ...r, closeRateOverride: value === "" ? null : (parseFloat(value) || 0) }
          : r
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/assumptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: rows.map(({ stage, conversionToNext, avgDaysInStage, closeRateOverride }) => ({
            stage,
            conversionToNext,
            avgDaysInStage,
            closeRateOverride,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      // Sync local rows with the server's materialized close rates.
      if (Array.isArray(json.rows)) {
        const byStage = new Map<string, AssumptionRow>(
          (json.rows as AssumptionRow[]).map((r) => [r.stage, r])
        );
        setRows((prev) =>
          prev.map((r) => {
            const fresh = byStage.get(r.stage);
            return fresh
              ? { ...r, overallCloseRate: fresh.overallCloseRate, closeRateOverride: fresh.closeRateOverride }
              : r;
          })
        );
      }
      setMsg("Saved ✓");
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        Pipeline Stage Assumptions
      </h2>
      <p className="text-xs text-slate-500 mb-5">
        These values are the single source of truth for the Dashboard weighted forecast, the Leads
        pipeline math, and the Analyzer conversion analysis. Overall Close Rate is derived from the
        conversion rates (cumulative funnel math); set an override to pin a specific rate.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <th className="px-5 py-3 pr-6 w-48">Stage</th>
              <th className="px-5 py-3 pr-6 text-right w-36">Conv. to Next</th>
              <th className="px-5 py-3 pr-6 text-right w-56">Overall Close Rate</th>
              <th className="px-5 py-3 text-right w-36">Avg Days in Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isActive = ACTIVE_STAGES.has(row.stage);
              const derivedRate = derived.get(row.stage) ?? 0;
              const hasOverride = row.closeRateOverride != null;
              const effectiveRate = hasOverride ? row.closeRateOverride! : derivedRate;
              return (
                <tr key={row.stage} className="border-b border-slate-100 last:border-0 even:bg-slate-50/40 hover:bg-teal/5 transition-colors">
                  <td className="px-5 py-3 pr-6 font-semibold text-navy">
                    {STAGE_LABELS[row.stage] ?? row.stage}
                  </td>
                  <td className="px-5 py-2.5 pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={row.conversionToNext}
                        onChange={(e) => handleChange(row.stage, "conversionToNext", e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                      <span className="text-xs text-slate-400 w-8 text-right">
                        {(row.conversionToNext * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 pr-6">
                    {isActive ? (
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          derived <span className="font-semibold text-slate-500">{(derivedRate * 100).toFixed(1)}%</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={row.closeRateOverride ?? ""}
                            placeholder="override"
                            onChange={(e) => handleOverrideChange(row.stage, e.target.value)}
                            className={`w-24 px-2 py-1 text-sm text-right border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-teal/40 ${
                              hasOverride ? "border-teal text-teal" : "border-slate-200 text-navy"
                            }`}
                          />
                          <span className={`text-xs w-10 text-right ${hasOverride ? "text-teal font-semibold" : "text-slate-400"}`}>
                            {(effectiveRate * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-300">—</div>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.avgDaysInStage}
                        onChange={(e) => handleChange(row.stage, "avgDaysInStage", e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg text-navy font-medium focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                      <span className="text-xs text-slate-400 w-6">d</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save All Changes"}
        </button>
        {msg && (
          <p className={`text-xs font-medium ${msg.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}>
            {msg}
          </p>
        )}
        <p className="text-xs text-slate-400 ml-auto">
          Leave the override blank to use the derived close rate.
        </p>
      </div>
    </div>
  );
}
