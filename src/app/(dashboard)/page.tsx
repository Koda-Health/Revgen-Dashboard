import { Suspense } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { ComparisonSelector } from "@/components/dashboard/ComparisonSelector";
import { YearSelector } from "@/components/dashboard/YearSelector";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { RevenueGoalCard } from "@/components/dashboard/RevenueGoalCard";
import { RevenueWaterfall } from "@/components/dashboard/RevenueWaterfall";
import { getDashboardData } from "@/lib/dashboard-data";
import { PipelineSplitWidgets } from "@/components/dashboard/PipelineSplitWidgets";

type Props = {
  searchParams: { compare?: string; year?: string };
};

export default async function DashboardPage({ searchParams }: Props) {
  const raw = parseInt(searchParams.compare ?? "30", 10);
  const comparisonDays = isNaN(raw) ? 30 : raw;
  const currentYear = new Date().getFullYear();
  const rawYear = parseInt(searchParams.year ?? String(currentYear), 10);
  const year = isNaN(rawYear) ? currentYear : rawYear;
  const data = await getDashboardData(comparisonDays, year);

  return (
    <div>
      {data.revenueGoal === 0 && (
        <div className="mx-6 mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 font-medium">
          No fiscal config found for {year}. Go to{" "}
          <a href="/settings" className="underline hover:text-yellow-900">Settings</a>{" "}
          to set revenue targets for this year.
        </div>
      )}
      <TopBar
        title="Dashboard"
        exportId="export-content"
        action={
          <Suspense>
            <div className="flex items-center gap-2">
              <YearSelector />
              <ComparisonSelector />
            </div>
          </Suspense>
        }
      />
      <div id="export-content" className="p-6 space-y-8">
        <DashboardKpiStrip data={data} />
        <PipelineSplitWidgets data={data} />
        <RevenueGoalCard data={data} />
        <RevenueWaterfall data={data.waterfallByStage} />
      </div>
    </div>
  );
}
