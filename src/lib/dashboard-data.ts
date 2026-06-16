import { prisma } from "@/lib/prisma";
import { pipelineForStage, IMPLEMENTATION_LAG_DAYS } from "@/lib/stages";
import type { DealRow } from "@/components/ui/DealTable";
import type { WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";
export type { BreakdownEntry } from "@/lib/format";
export type { WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";

export type DashboardData = {
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
  const fiscalYearEnd = new Date(`${year}-12-31T23:59:59`);

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
  const yearMs = fiscalYearEnd.getTime() - fiscalYearStart.getTime();
  const rateMap = new Map(assumptions.map((a) => [a.stage as string, a.overallCloseRate]));

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

  const weightedForecastBreakdown: WeightedForecastDeal[] = [];
  const weightedForecast = activeDeals.reduce((sum, deal) => {
    if (pipelineForStage(deal.stage as string | null) !== "new_logo") return sum;
    if (!deal.expectedClosedDate || !deal.stage || !deal.value) return sum;
    const closeDate = new Date(deal.expectedClosedDate);
    if (closeDate < fiscalYearStart || closeDate > fiscalYearEnd) return sum;
    const closeRate = rateMap.get(deal.stage as string) ?? 0;
    // Add implementation period: revenue starts IMPLEMENTATION_LAG_DAYS after close date
    const revenueStartDate = new Date(closeDate.getTime() + IMPLEMENTATION_LAG_DAYS * 24 * 60 * 60 * 1000);
    const remainingMs = Math.max(0, fiscalYearEnd.getTime() - revenueStartDate.getTime());
    const timingFactor = yearMs > 0 ? remainingMs / yearMs : 0;
    const contribution = Number(deal.value) * closeRate * timingFactor;
    weightedForecastBreakdown.push({
      id: deal.id,
      name: deal.name,
      companyName: deal.company?.name ?? null,
      stage: deal.stage as string,
      value: Number(deal.value),
      closeRate,
      expectedClosedDate: deal.expectedClosedDate.toISOString(),
      timingFactor,
      contribution,
    });
    return sum + contribution;
  }, 0);
  weightedForecastBreakdown.sort((a, b) => b.contribution - a.contribution);

  // Revenue
  const revenueToDate = Number(actualRevSum._sum.amount ?? 0);
  const expectedFromExisting = Number(fiscalConfig?.expectedFromExisting ?? 0);
  const bookedRevenue = revenueToDate + expectedFromExisting;

  // Goal metrics
  const revenueGoal = Number(fiscalConfig?.revenueGoal ?? 0);
  const existingArr = Number(fiscalConfig?.existingArr ?? 0);
  const revenueGap = Math.max(0, revenueGoal - bookedRevenue);
  const pctOfGoal = revenueGoal > 0 ? bookedRevenue / revenueGoal : 0;
  const pipelineCoverage = revenueGap > 0 ? pipelineTotal / revenueGap : 0;

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
    .map((d) => ({
      id: d.id,
      name: d.name,
      companyName: d.company?.name ?? null,
      companyType: null, // not needed for dashboard drill-downs; Task 7 adds this field to DealRow
      value: Number(d.value),
      stage: d.stage as string | null,
      source: d.source as string | null,
      typeOfDeal: d.typeOfDeal as string | null,
      status: d.status as string,
      daysInStage: d.stageEnteredAt
        ? Math.floor((today.getTime() - new Date(d.stageEnteredAt).getTime()) / 86400000)
        : null,
      firstConvoDate: d.firstConvoDate?.toISOString() ?? null,
      expectedClosedDate: d.expectedClosedDate?.toISOString() ?? null,
    }));

  return {
    pipelineTotal, weightedForecast, weightedForecastBreakdown, activeDealCount, avgDealSize, pipelineCoverage,
    pipelineSplit: { newLogo: newLogoSplit, renewal: renewalSplit, combined: combinedSplit },
    revenueToDate, expectedFromExisting, bookedRevenue,
    revenueGoal, existingArr, revenueGap, pctOfGoal,
    year,
    pipelineTotalDelta, weightedForecastDelta,
    topDeals,
  };
}
