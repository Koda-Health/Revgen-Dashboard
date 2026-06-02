// src/components/sources/SyncStatusGrid.tsx
"use client";

import { useState } from "react";
import type { SourceStatus } from "@/types/sources";

type DbCounts = {
  deals: number;
  companies: number;
  snapshotManifests: number;
  revenueEntries: number;
};

type Props = {
  sources: SourceStatus[];
  dbCounts: DbCounts;
};

function staleness(at: string | null): "fresh" | "stale" | "old" | "never" {
  if (!at) return "never";
  const hours = (Date.now() - new Date(at).getTime()) / 3_600_000;
  if (hours < 26) return "fresh";
  if (hours < 50) return "stale";
  return "old";
}

const STATUS_COLORS = {
  fresh:  { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  stale:  { dot: "bg-yellow-400",  text: "text-yellow-700",  bg: "bg-yellow-50" },
  old:    { dot: "bg-coral",       text: "text-red-700",     bg: "bg-red-50" },
  never:  { dot: "bg-gray-300",    text: "text-slate-500",    bg: "bg-gray-50" },
};

function formatRelative(at: string): string {
  const d = new Date(at);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SOURCE_DETAIL_LABELS: Record<string, (d: Record<string, unknown>) => string> = {
  attio:    (d) => `${d.dealsUpserted ?? 0} deals · ${d.companiesUpserted ?? 0} companies`,
  snapshot: (d) => `${d.activeDealCount ?? 0} deals captured`,
};

export function SyncStatusGrid({ sources, dbCounts }: Props) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function handleSync(sourceKey: string) {
    setSyncing(sourceKey);
    setResults((r) => ({ ...r, [sourceKey]: "" }));
    try {
      const res = await fetch("/api/sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setResults((r) => ({ ...r, [sourceKey]: "Synced ✓" }));
    } catch (e) {
      setResults((r) => ({ ...r, [sourceKey]: `Error: ${e instanceof Error ? e.message : "failed"}` }));
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-6">
        {sources.map((src) => {
          const age = staleness(src.lastSync?.at ?? null);
          const colors = STATUS_COLORS[age];
          const isSyncing = syncing === src.key;
          const disabled = src.key === "snapshot";
          return (
            <div key={src.key} className="bg-white rounded-card shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-sm font-semibold text-navy">{src.label}</span>
                </div>
                {!disabled && (
                  <button
                    onClick={() => handleSync(src.key)}
                    disabled={!!syncing}
                    className="text-xs px-3 py-1 rounded-lg bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </button>
                )}
              </div>

              {src.lastSync ? (
                <>
                  <p className="text-xs text-slate-400 mb-1">
                    Last sync: <span className="font-medium text-slate-600">{formatRelative(src.lastSync.at)}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {SOURCE_DETAIL_LABELS[src.key]?.(src.lastSync.details) ?? ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">Never synced</p>
              )}

              {results[src.key] && (
                <p className={`text-xs mt-2 font-medium ${results[src.key].startsWith("Error") ? "text-coral" : "text-emerald-600"}`}>
                  {results[src.key]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* DB record counts */}
      <div className="bg-white rounded-card shadow-card p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Database Records</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Deals", value: dbCounts.deals },
            { label: "Companies", value: dbCounts.companies },
            { label: "Snapshots", value: dbCounts.snapshotManifests },
            { label: "Revenue Entries", value: dbCounts.revenueEntries },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-navy tabular-nums">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
