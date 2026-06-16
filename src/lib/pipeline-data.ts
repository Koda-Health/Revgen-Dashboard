import { prisma } from "@/lib/prisma";
import { weightedForecast } from "@/lib/calculations";
import type { DealRow } from "@/components/ui/DealTable";
import {
  type Pipeline, NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK,
  pipelineForStage,
} from "@/lib/stages";

import type { BreakdownEntry } from "@/lib/format";
export type { BreakdownEntry } from "@/lib/format";

export type PipelineData = {
  pipeline: Pipeline;
  // KPIs
  pipelineTotal: number;
  activeDealCount: number;
  avgDealSize: number;
  weightedForecast: number;
  winRateTtm: number;
  avgSalesCycleDays: number;
  // Breakdowns for 2×2 bar charts
  byStage: BreakdownEntry[];
  bySource: BreakdownEntry[];
  byCompanyType: BreakdownEntry[];
  byDealType: BreakdownEntry[];
  // All active deals for interactive breakdown and drill-down modals
  activeDeals: DealRow[];
  // Stage assumptions for client-side weighted forecast computation
  stageAssumptions: { stage: string; overallCloseRate: number }[];
};

const STAGE_SORT_BY_PIPELINE: Record<Pipeline, string[]> = {
  new_logo: [...NEW_LOGO_STAGE_ORDER],
  renewal: [...RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK],
};

function toEntries(
  map: Record<string, { value: number; count: number }>
): BreakdownEntry[] {
  return Object.entries(map)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.value - a.value);
}

function toStageEntries(
  map: Record<string, { value: number; count: number }>,
  stageSort: string[]
): BreakdownEntry[] {
  return Object.entries(map)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => {
      const ai = stageSort.indexOf(a.key);
      const bi = stageSort.indexOf(b.key);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

export async function getPipelineData(pipeline: Pipeline = "new_logo"): Promise<PipelineData> {
  const today = new Date();
  const ttmStart = new Date(today);
  ttmStart.setFullYear(ttmStart.getFullYear() - 1);

  const [deals, assumptions] = await Promise.all([
    prisma.deal.findMany({
      select: {
        id: true, name: true, value: true, stage: true, source: true,
        typeOfDeal: true, status: true, stageEnteredAt: true,
        firstConvoDate: true, expectedClosedDate: true,
        closedWonDate: true, closedLostDate: true,
        company: { select: { name: true, salesType: true } },
      },
    }),
    prisma.stageAssumption.findMany(),
  ]);

  const pipelineDeals = deals.filter(
    (d) => pipelineForStage(d.stage as string | null) === pipeline
  );

  const activeDeals = pipelineDeals.filter((d) => d.status === "active" || d.status === "stalled");
  const pipelineTotal = activeDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const activeDealCount = activeDeals.length;
  const avgDealSize = activeDealCount > 0 ? pipelineTotal / activeDealCount : 0;

  const forecast = weightedForecast(
    activeDeals.map((d) => ({ value: d.value, stage: d.stage, status: "active" as const })),
    assumptions
  );

  // Win rate TTM
  const ttmClosed = pipelineDeals.filter((d) => {
    const closeDate = d.closedWonDate ?? d.closedLostDate;
    return closeDate && new Date(closeDate) >= ttmStart;
  });
  const ttmWon = ttmClosed.filter((d) => d.status === "won").length;
  const winRateTtm = ttmClosed.length > 0 ? ttmWon / ttmClosed.length : 0;

  // Avg sales cycle TTM (first_convo_date → closed_won_date).
  // Skip records where the manual close_date predates the stage-history
  // First Conversation entry — that's data hygiene noise (backfilled close_date
  // or a re-opened deal), not a real negative-length sale.
  const wonCycles = pipelineDeals.flatMap((d) => {
    if (d.status !== "won" || !d.firstConvoDate || !d.closedWonDate) return [];
    if (new Date(d.closedWonDate) < ttmStart) return [];
    const days =
      (new Date(d.closedWonDate).getTime() - new Date(d.firstConvoDate).getTime()) / 86400000;
    return days >= 0 ? [days] : [];
  });
  const avgSalesCycleDays =
    wonCycles.length > 0
      ? Math.round(wonCycles.reduce((s, d) => s + d, 0) / wonCycles.length)
      : 0;

  // Breakdowns (active deals only)
  const byStageMap: Record<string, { value: number; count: number }> = {};
  const bySourceMap: Record<string, { value: number; count: number }> = {};
  const byCompanyTypeMap: Record<string, { value: number; count: number }> = {};
  const byDealTypeMap: Record<string, { value: number; count: number }> = {};

  for (const deal of activeDeals) {
    const val = Number(deal.value ?? 0);

    const stageKey = (deal.stage as string) ?? "unknown";
    if (!byStageMap[stageKey]) byStageMap[stageKey] = { value: 0, count: 0 };
    byStageMap[stageKey].value += val;
    byStageMap[stageKey].count += 1;

    const sourceKey = (deal.source as string) ?? "unknown";
    if (!bySourceMap[sourceKey]) bySourceMap[sourceKey] = { value: 0, count: 0 };
    bySourceMap[sourceKey].value += val;
    bySourceMap[sourceKey].count += 1;

    const typeKey = (deal.typeOfDeal as string) ?? "unknown";
    if (!byDealTypeMap[typeKey]) byDealTypeMap[typeKey] = { value: 0, count: 0 };
    byDealTypeMap[typeKey].value += val;
    byDealTypeMap[typeKey].count += 1;

    const compTypeKey = (deal.company?.salesType as string) ?? "unknown";
    if (!byCompanyTypeMap[compTypeKey]) byCompanyTypeMap[compTypeKey] = { value: 0, count: 0 };
    byCompanyTypeMap[compTypeKey].value += val;
    byCompanyTypeMap[compTypeKey].count += 1;
  }

  // Serialize active deals for client components
  const activeDealRows: DealRow[] = activeDeals.map((d) => ({
    id: d.id,
    name: d.name,
    companyName: d.company?.name ?? null,
    companyType: (d.company?.salesType as string) ?? null,
    value: d.value != null ? Number(d.value) : null,
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
    pipeline,
    pipelineTotal, activeDealCount, avgDealSize, weightedForecast: forecast,
    winRateTtm, avgSalesCycleDays,
    byStage: toStageEntries(byStageMap, STAGE_SORT_BY_PIPELINE[pipeline]),
    bySource: toEntries(bySourceMap),
    byCompanyType: toEntries(byCompanyTypeMap),
    byDealType: toEntries(byDealTypeMap),
    activeDeals: activeDealRows,
    stageAssumptions: assumptions.map((a) => ({ stage: a.stage as string, overallCloseRate: a.overallCloseRate })),
  };
}
