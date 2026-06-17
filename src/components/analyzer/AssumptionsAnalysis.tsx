"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { formatPct } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/stages";
import { ExportButton } from "@/components/ui/ExportButton";
import type { AssumptionRow, SnapshotConversionRow } from "@/lib/assumptions-analysis";

type Props = {
  snapshotManifest: { id: string; date: string } | null;
};

function DeltaArrow({
  model,
  actual,
  threshold = 0.01,
}: {
  model: number;
  actual: number | null;
  threshold?: number;
}) {
  if (actual == null) return <span className="text-gray-300">—</span>;
  const diff = actual - model;
  if (Math.abs(diff) < threshold) return <span className="text-gray-400">~</span>;
  return diff > 0 ? (
    <span className="text-emerald-600 font-semibold">↑</span>
  ) : (
    <span className="text-coral font-semibold">↓</span>
  );
}

function pctOrDash(v: number | null): string {
  return v != null ? formatPct(v) : "—";
}

function daysOrDash(v: number | null): string {
  return v != null ? `${v}d` : "—";
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export function AssumptionsAnalysis({ snapshotManifest }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<AssumptionRow[] | null>(null);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotConversionRow[] | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");

  const fetchActuals = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate)   params.set("toDate",   toDate);
    const url = `/api/analyzer/assumptions${params.size ? `?${params}` : ""}`;

    fetch(url)
      .then((r) => r.json())
      .then((d: { rows: AssumptionRow[] }) => setRows(d.rows))
      .catch(() => setRows([]));
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchActuals();
  }, [fetchActuals]);

  useEffect(() => {
    if (!snapshotManifest) {
      setSnapshotRows(null);
      setSnapshotAt(null);
      return;
    }
    fetch(`/api/analyzer/assumptions?manifestId=${snapshotManifest.id}`)
      .then((r) => r.json())
      .then((d: { snapshotRows: SnapshotConversionRow[]; snapshotAt: string }) => {
        setSnapshotRows(d.snapshotRows);
        setSnapshotAt(d.snapshotAt);
      })
      .catch(() => setSnapshotRows(null));
  }, [snapshotManifest]);

  const snapshotLabel = snapshotAt ? formatDateLabel(snapshotAt) : null;

  const dateRangeLabel = fromDate && toDate
    ? `${fromDate} – ${toDate}`
    : fromDate
    ? `From ${fromDate}`
    : toDate
    ? `As of ${toDate}`
    : null;

  return (
    <div ref={cardRef} className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Assumptions Analysis
        </h2>
        <ExportButton getElement={() => cardRef.current} filename="assumptions-analysis" variant="icon" />
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Model assumptions compared to actuals derived from current deal data.
        {snapshotLabel && (
          <> The <strong className="text-navy">{snapshotLabel}</strong> column shows conversion rates from the selected snapshot.</>
        )}
      </p>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-4 p-5 bg-slate-50 rounded-card border border-slate-200 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Actuals From (optional)
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Actuals To / As-Of (optional)
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-36 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
          />
        </div>
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 mt-4"
          >
            Clear
          </button>
        )}
        {dateRangeLabel && (
          <p className="text-xs text-slate-500 mt-4">
            Filtering actuals by stage entry date: <strong className="text-navy">{dateRangeLabel}</strong>
          </p>
        )}
      </div>

      {!rows ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-5 py-3 pr-4">Stage</th>
                <th className="px-5 py-3 pr-4 text-right" colSpan={snapshotLabel ? 3 : 2}>
                  Conv. to Next
                </th>
                <th className="px-5 py-3 text-right" colSpan={2}>
                  Avg Days in Stage
                </th>
              </tr>
              <tr className="border-b border-slate-200 text-left text-[10px] text-slate-400">
                <th className="px-5 py-3 pr-4"></th>
                <th className="px-5 py-3 pr-2 text-right">Model</th>
                <th className={`px-5 py-3 text-right ${snapshotLabel ? "pr-2" : "pr-4"}`}>Actual</th>
                {snapshotLabel && (
                  <th className="px-5 py-3 pr-4 text-right" style={{ color: "#34B3D4" }}>{snapshotLabel}</th>
                )}
                <th className="px-5 py-3 pr-2 text-right">Model</th>
                <th className="px-5 py-3 text-right">Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: AssumptionRow) => {
                const snap = snapshotRows?.find((s) => s.stage === row.stage) ?? null;
                return (
                  <tr key={row.stage} className="border-b border-slate-100 last:border-0 even:bg-slate-50/40 hover:bg-teal/5 transition-colors">
                    <td className="px-5 py-3 pr-4 font-medium text-navy">
                      {STAGE_LABELS[row.stage] ?? row.stage}
                    </td>
                    <td className="px-5 py-3 pr-2 text-right text-slate-500">
                      {formatPct(row.modelConversionToNext)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold text-navy tabular-nums ${snapshotLabel ? "pr-2" : "pr-4"}`}>
                      <span className="mr-1">{pctOrDash(row.actualConversionToNext)}</span>
                      <DeltaArrow model={row.modelConversionToNext} actual={row.actualConversionToNext} />
                    </td>
                    {snapshotLabel && (
                      <td className="px-5 py-3 pr-4 text-right font-semibold" style={{ color: "#34B3D4" }}>
                        <span className="mr-1">{pctOrDash(snap?.conversionToNext ?? null)}</span>
                        <DeltaArrow model={row.modelConversionToNext} actual={snap?.conversionToNext ?? null} />
                      </td>
                    )}
                    <td className="px-5 py-3 pr-2 text-right text-slate-500">
                      {row.modelAvgDaysInStage}d
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-navy tabular-nums">
                      <span className="mr-1">{daysOrDash(row.actualAvgDaysInStage)}</span>
                      <DeltaArrow model={row.modelAvgDaysInStage} actual={row.actualAvgDaysInStage} threshold={1} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-4">
        ↑ Actual outperforms model &nbsp;·&nbsp; ↓ Actual underperforms model &nbsp;·&nbsp; ~ Within 1%
      </p>
    </div>
  );
}
