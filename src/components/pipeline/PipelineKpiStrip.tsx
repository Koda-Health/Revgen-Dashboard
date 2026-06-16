import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency, formatPct } from "@/lib/format";
import type { PipelineData } from "@/lib/pipeline-data";

export function PipelineKpiStrip({
  data,
}: {
  data: PipelineData;
  variant?: "new_logo" | "renewal";
}) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <KpiCard label="Total Pipeline" value={formatCurrency(data.pipelineTotal)} />
      <KpiCard label="Active Deals" value={String(data.activeDealCount)} />
      <KpiCard label="Avg Deal Size" value={formatCurrency(data.avgDealSize)} />
      <KpiCard label="Win Rate (TTM)" value={formatPct(data.winRateTtm)} />
      <KpiCard
        label="Avg Sales Cycle"
        value={`${data.avgSalesCycleDays}d`}
        subValue="First Convo → Close"
      />
    </div>
  );
}
