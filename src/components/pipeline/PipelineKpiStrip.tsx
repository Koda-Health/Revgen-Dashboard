import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency, formatPct } from "@/lib/format";
import type { PipelineData } from "@/lib/pipeline-data";

export function PipelineKpiStrip({
  data,
  variant = "new_logo",
}: {
  data: PipelineData;
  variant?: "new_logo" | "renewal";
}) {
  // Shared cards (both variants).
  const sharedCards = [
    <KpiCard key="pipeline" label="Total Pipeline" value={formatCurrency(data.pipelineTotal)} />,
    <KpiCard key="active" label="Active Deals" value={String(data.activeDealCount)} />,
    <KpiCard key="avg" label="Avg Deal Size" value={formatCurrency(data.avgDealSize)} />,
  ];

  const variantCards =
    variant === "renewal"
      ? [
          <KpiCard
            key="at-risk"
            label="At-Risk ARR"
            value={formatCurrency(data.atRiskArr)}
            accentColor="#EE8363"
          />,
          <KpiCard key="churned" label="Churned (TTM)" value={String(data.churnedCount)} />,
        ]
      : [
          <KpiCard key="win-rate" label="Win Rate (TTM)" value={formatPct(data.winRateTtm)} />,
          <KpiCard
            key="sales-cycle"
            label="Avg Sales Cycle"
            value={`${data.avgSalesCycleDays}d`}
            subValue="First Convo → Close"
          />,
        ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {sharedCards}
      {variantCards}
    </div>
  );
}
