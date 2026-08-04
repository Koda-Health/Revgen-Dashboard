"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { StagePill } from "@/components/ui/StagePill";
import { DealDetailModal } from "@/components/dashboard/DealDetailModal";
import { formatCurrency, formatDelta, SOURCE_LABELS, DEAL_TYPE_LABELS } from "@/lib/format";
import type { BucketDeal } from "@/lib/cohort-analysis";
import type { DealRow } from "@/components/ui/DealTable";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  deals: BucketDeal[];
  showStageA?: boolean;  // false for "New Pipeline" bucket
  showStageB?: boolean;  // false for "Not Found" bucket
};

function bucketDealToDealRow(b: BucketDeal): DealRow {
  return {
    id: b.dealId,
    name: b.name,
    companyName: b.companyName,
    companyType: null,
    value: b.valueB ?? b.valueA, // prefer most-recent known value
    stage: b.stageB ?? b.stageA, // prefer most-recent stage
    source: b.source,
    typeOfDeal: b.typeOfDeal,
    status: b.status ?? "—",
    daysInStage: b.daysInStage,
    paceStatus: "no_benchmark",
    firstConvoDate: b.firstConvoDate,
    expectedClosedDate: b.expectedClosedDate,
  };
}

function ValueDeltaCell({ valueA, valueB }: { valueA: number | null; valueB: number | null }) {
  if (valueA == null || valueB == null) return <span className="text-slate-400">—</span>;
  const delta = valueB - valueA;
  if (delta === 0) return <span className="text-slate-400">—</span>;
  const fmt = formatDelta(delta);
  return (
    <span className={fmt.positive ? "text-emerald-600 font-semibold" : "text-coral font-semibold"}>
      {fmt.display}
    </span>
  );
}

export function CohortBucketModal({
  open, onClose, title, deals, showStageA = true, showStageB = true,
}: Props) {
  const [selected, setSelected] = useState<DealRow | null>(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={() => { setSelected(null); onClose(); }} title={title} width="2xl">
        {deals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No deals in this bucket.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3 pr-4">Deal</th>
                  <th className="px-5 py-3 pr-4">Company</th>
                  {showStageA && <th className="px-5 py-3 pr-4 text-right">Value (A)</th>}
                  {showStageB && <th className="px-5 py-3 pr-4 text-right">Value (B)</th>}
                  {showStageA && showStageB && <th className="px-5 py-3 pr-4 text-right">Δ</th>}
                  {showStageA && <th className="px-5 py-3 pr-4">Stage (A)</th>}
                  {showStageB && <th className="px-5 py-3 pr-4">Stage (B)</th>}
                  <th className="px-5 py-3 pr-4">Source</th>
                  <th className="px-5 py-3">Deal Type</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr
                    key={d.dealId}
                    onClick={() => setSelected(bucketDealToDealRow(d))}
                    className="border-b border-slate-100 last:border-0 even:bg-slate-50/40 hover:bg-teal/5 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 pr-4 font-semibold text-navy">{d.name}</td>
                    <td className="px-5 py-3 pr-4 text-slate-600">{d.companyName ?? "—"}</td>
                    {showStageA && (
                      <td
                        className={`px-5 py-3 pr-4 text-right tabular-nums ${
                          showStageB ? "text-slate-600" : "font-semibold text-navy"
                        }`}
                      >
                        {d.valueA != null ? formatCurrency(d.valueA) : "—"}
                      </td>
                    )}
                    {showStageB && (
                      <td className="px-5 py-3 pr-4 text-right font-semibold text-navy tabular-nums">
                        {d.valueB != null ? formatCurrency(d.valueB) : "—"}
                      </td>
                    )}
                    {showStageA && showStageB && (
                      <td className="px-5 py-3 pr-4 text-right tabular-nums">
                        <ValueDeltaCell valueA={d.valueA} valueB={d.valueB} />
                      </td>
                    )}
                    {showStageA && (
                      <td className="px-5 py-3 pr-4">
                        {d.stageA ? <StagePill value={d.stageA} /> : <span className="text-slate-400">—</span>}
                      </td>
                    )}
                    {showStageB && (
                      <td className="px-5 py-3 pr-4">
                        {d.stageB ? <StagePill value={d.stageB} /> : <span className="text-slate-400">—</span>}
                      </td>
                    )}
                    <td className="px-5 py-3 pr-4 text-slate-600 text-xs">
                      {d.source ? (SOURCE_LABELS[d.source] ?? d.source) : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {d.typeOfDeal ? (DEAL_TYPE_LABELS[d.typeOfDeal] ?? d.typeOfDeal) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <DealDetailModal deal={selected} onClose={() => setSelected(null)} />
    </>
  );
}
