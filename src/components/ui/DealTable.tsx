import { formatCurrency, SOURCE_LABELS, DEAL_TYPE_LABELS } from "@/lib/format";
import { StagePill } from "@/components/ui/StagePill";
import type { PaceStatus } from "@/lib/stage-pace";

export type DealRow = {
  id: string;
  name: string;
  companyName: string | null;
  companyType: string | null;
  value: number | null;
  stage: string | null;
  source: string | null;
  typeOfDeal: string | null;
  status: string;
  daysInStage: number | null;
  paceStatus: PaceStatus;
  firstConvoDate: string | null;
  expectedClosedDate: string | null;
};

type Props = {
  deals: DealRow[];
  onRowClick?: (deal: DealRow) => void;
  compact?: boolean;
};

export function DealTable({ deals, onRowClick, compact = false }: Props) {
  if (deals.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No deals to display.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left">
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Deal</th>
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Value</th>
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stage</th>
            {!compact && <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source</th>}
            {!compact && <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>}
            {!compact && <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Exp. Close</th>}
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Days in Stage</th>
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {deals.map((deal, i) => (
            <tr
              key={deal.id}
              className={`${i % 2 === 1 ? "bg-slate-50/40" : ""} ${onRowClick ? "cursor-pointer hover:bg-teal/5" : ""} transition-colors`}
              onClick={() => onRowClick?.(deal)}
            >
              <td className="px-5 py-3">
                <p className="font-semibold text-navy truncate max-w-[200px]">{deal.name}</p>
                {deal.companyName && (
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">{deal.companyName}</p>
                )}
              </td>
              <td className="px-5 py-3 font-semibold text-slate-700 tabular-nums">
                {deal.value != null ? formatCurrency(deal.value) : "—"}
              </td>
              <td className="px-5 py-3">
                {deal.stage ? <StagePill value={deal.stage} /> : "—"}
              </td>
              {!compact && (
                <td className="px-5 py-3 text-slate-600">
                  {deal.source ? (SOURCE_LABELS[deal.source] ?? deal.source) : "—"}
                </td>
              )}
              {!compact && (
                <td className="px-5 py-3 text-slate-600">
                  {deal.typeOfDeal ? (DEAL_TYPE_LABELS[deal.typeOfDeal] ?? deal.typeOfDeal) : "—"}
                </td>
              )}
              {!compact && (
                <td className="px-5 py-3 text-slate-500 text-xs tabular-nums">
                  {deal.expectedClosedDate
                    ? new Date(deal.expectedClosedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </td>
              )}
              <td className="px-5 py-3 text-slate-600 tabular-nums">
                {deal.daysInStage != null ? `${deal.daysInStage}d` : "—"}
              </td>
              <td className="px-5 py-3">
                <StagePill value={deal.paceStatus} type="pace" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
