import { prisma } from "@/lib/prisma";
import { pipelineForStage, NEW_LOGO_STAGE_ORDER, STAGE_LABELS } from "@/lib/stages";
import { computePaceStatus } from "@/lib/stage-pace";
import type { DealRow } from "@/components/ui/DealTable";
import { buildWeightedForecastBreakdown, type WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";
export type { BreakdownEntry } from "@/lib/format";
export type { WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";

export type WaterfallStage = {
  stage: string;
  label: string;
  pipeline: number;   // active new-logo pipeline value at this stage
  closeRate: number;  // stage overall close rate
  weighted: number;   // pipeline * closeRate
  cumulative: number; // running sum of weighted across stages
};

export type DashboardData = {
  waterfallByStage: WaterfallStage[];
  // KPIs
  pipelineTotal: number;
  activeDealCount: number;
  avgDealSize: number;
  weightedForecast: number;
  weightedForecastBreakdown: WeightedForecastDeal[];
  pipelineCoverage: number;
  pipelineSplit: {
    newLogo: { pipeline: number; weighted: number; count: number };
    renewal: { pipeline: number; weighted: number; count: number };
    combined: { pipeline: number; weighted: number; count: number };
  };
  // Revenue
  revenueToDate: number;
  expectedFromExisting: number;
  bookedRevenue: number;
  revenueGoal: number;
  existingArr: number;
  revenueGap: number;
  pctOfGoal: number;
  year: number;
  // Deltas vs comparison snapshot
  pipelineTotalDelta: number | null;
  weightedForecastDelta: number | null;
  // Top deals
  topDeals: DealRow[];
};

export async function getDashboardData(comparisonDays: number, year: number): Promise<DashboardData> {
  const today = new Date();
  const fiscalYearStart = new Date(`${year}-01-01`);

  const [deals, assumptions, fiscalConfig, actualRevSum] = await Promise.all([
    prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        value: true,
        stage: true,
        source: true,
        typeOfDeal: true,
        status: true,
        stageEnteredAt: true,
        firstConvoDate: true,
        expectedClosedDate: true,
        closedWonDate: true,
        company: { select: { name: true } },
      },
      orderBy: { value: "desc" },
    }),
    prisma.stageAssumption.findMany(),
    prisma.fiscalConfig.findFirst({ where: { fiscalYear: year } }),
    prisma.actualRevenueEntry.aggregate({
      _sum: { amount: true },
      where: {
        periodStart: { gte: fiscalYearStart, lt: today },
      },
    }),
  ]);

  // All active/stalled deals
  const activeDeals = deals.filter((d) => d.status === "active" || d.status === "stalled");
  const pipelineTotal = activeDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const activeDealCount = activeDeals.length;
  const avgDealSize = activeDealCount > 0 ? pipelineTotal / activeDealCount : 0;

  // Weighted forecast (in-year only):
  // Only deals where expectedClosedDate falls within the selected fiscal year.
  // timingFactor = fraction of year remaining after close date (e.g., Aug close = ~5/12 months left)
  const rateMap = new Map(assumptions.map((a) => [a.stage as string, a.overallCloseRate]));
  const avgDaysMap = new Map(assumptions.map((a) => [a.stage as string, a.avgDaysInStage]));

  const splitAgg = (predicate: (stage: string | null) => boolean) => {
    const ds = activeDeals.filter((d) => predicate(d.stage as string | null));
    const pipeline = ds.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const weighted = ds.reduce((s, d) => s + Number(d.value ?? 0) * (rateMap.get(d.stage as string) ?? 0), 0);
    return { pipeline, weighted, count: ds.length };
  };
  const newLogoSplit = splitAgg((s) => pipelineForStage(s) === "new_logo");
  const renewalSplit = splitAgg((s) => pipelineForStage(s) === "renewal");
  const combinedSplit = {
    pipeline: newLogoSplit.pipeline + renewalSplit.pipeline,
    weighted: newLogoSplit.weighted + renewalSplit.weighted,
    count: newLogoSplit.count + renewalSplit.count,
  };

  // Weighted forecast breakdown (new-logo, projected-default timing). Shared builder keeps
  // this identical to the Leads-tab computation.
  const weightedForecastBreakdown = buildWeightedForecastBreakdown(
    activeDeals
      .filter((d) => pipelineForStage(d.stage as string | null) === "new_logo")
      .map((d) => ({
        id: d.id,
        name: d.name,
        companyName: d.company?.name ?? null,
        stage: d.stage as string,
        value: Number(d.value ?? 0),
        stageEnteredAt: d.stageEnteredAt ?? null,
        expectedClosedDate: d.expectedClosedDate ?? null,
      })),
    assumptions.map((a) => ({
      stage: a.stage as string,
      overallCloseRate: a.overallCloseRate,
      avgDaysInStage: a.avgDaysInStage,
    })),
    year,
    today,
  );
  const weightedForecast = weightedForecastBreakdown.reduce((s, d) => s + d.contribution, 0);

  // Weighted-pipeline waterfall by new-logo stage (value x close rate, untimed).
  // Steps accumulate to total weighted new-logo pipeline; drives the dashboard chart.
  const newLogoActiveDeals = activeDeals.filter(
    (d) => pipelineForStage(d.stage as string | null) === "new_logo"
  );
  let waterfallCumulative = 0;
  const waterfallByStage: WaterfallStage[] = NEW_LOGO_STAGE_ORDER.map((stage) => {
    const atStage = newLogoActiveDeals.filter((d) => d.stage === stage);
    const pipeline = atStage.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const closeRate = rateMap.get(stage) ?? 0;
    const weighted = pipeline * closeRate;
    waterfallCumulative += weighted;
    return {
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      pipeline,
      closeRate,
      weighted,
      cumulative: waterfallCumulative,
    };
  });

  // Revenue
  const revenueToDate = Number(actualRevSum._sum.amount ?? 0);
  const expectedFromExisting = Number(fiscalConfig?.expectedFromExisting ?? 0);
  const bookedRevenue = revenueToDate + expectedFromExisting;

  // Goal metrics
  const revenueGoal = Number(fiscalConfig?.revenueGoal ?? 0);
  const existingArr = Number(fiscalConfig?.existingArr ?? 0);
  const revenueGap = Math.max(0, revenueGoal - bookedRevenue);
  const pctOfGoal = revenueGoal > 0 ? bookedRevenue / revenueGoal : 0;
  // Coverage measures NEW-LOGO pipeline against the new-business gap (renewals are
  // represented on the expectedFromExisting side, so they're excluded here).
  const pipelineCoverage = revenueGap > 0 ? newLogoSplit.pipeline / revenueGap : 0;

  // Comparison snapshot
  const compareDate = new Date(today);
  compareDate.setDate(compareDate.getDate() - (isNaN(comparisonDays) ? 30 : comparisonDays));
  const compSnap = await prisma.pipelineSnapshot.findFirst({
    where: { capturedAt: { lte: compareDate } },
    orderBy: { capturedAt: "desc" },
  });
  const pipelineTotalDelta = compSnap ? pipelineTotal - Number(compSnap.pipelineTotal) : null;
  const weightedForecastDelta = compSnap ? weightedForecast - Number(compSnap.weightedForecast) : null;

  // Top 5 active deals with value > 0 (already sorted desc by value from DB)
  const topDeals: DealRow[] = activeDeals
    .filter((d) => Number(d.value ?? 0) > 0)
    .slice(0, 5)
    .map((d) => {
      const daysInStage = d.stageEnteredAt
        ? Math.floor((today.getTime() - new Date(d.stageEnteredAt).getTime()) / 86400000)
        : null;
      return {
        id: d.id,
        name: d.name,
        companyName: d.company?.name ?? null,
        companyType: null, // companyType not needed for dashboard drill-downs
        value: Number(d.value),
        stage: d.stage as string | null,
        source: d.source as string | null,
        typeOfDeal: d.typeOfDeal as string | null,
        status: d.status as string,
        daysInStage,
        paceStatus: computePaceStatus(daysInStage, avgDaysMap.get(d.stage as string)),
        firstConvoDate: d.firstConvoDate?.toISOString() ?? null,
        expectedClosedDate: d.expectedClosedDate?.toISOString() ?? null,
      };
    });

  return {
    pipelineTotal, weightedForecast, weightedForecastBreakdown, activeDealCount, avgDealSize, pipelineCoverage,
    pipelineSplit: { newLogo: newLogoSplit, renewal: renewalSplit, combined: combinedSplit },
    revenueToDate, expectedFromExisting, bookedRevenue,
    revenueGoal, existingArr, revenueGap, pctOfGoal,
    year,
    pipelineTotalDelta, weightedForecastDelta,
    topDeals,
    waterfallByStage,
  };
}
