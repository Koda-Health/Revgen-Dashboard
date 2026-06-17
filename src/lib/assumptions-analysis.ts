// src/lib/assumptions-analysis.ts
import { prisma } from "@/lib/prisma";
import { NEW_LOGO_STAGE_ORDER } from "@/lib/stages";

// New-logo ACQUISITION funnel. Renewals are analyzed separately (two-pipeline design).
const STAGE_ORDER = NEW_LOGO_STAGE_ORDER;
type ActiveStage = (typeof STAGE_ORDER)[number];

export type AssumptionRow = {
  stage: ActiveStage;
  // Model (from StageAssumption table)
  modelConversionToNext: number;
  modelAvgDaysInStage: number;
  // Actual (derived from live Deal data)
  actualConversionToNext: number | null;
  actualAvgDaysInStage: number | null;
  // Context counts
  dealsAtStage: number;
};

export type SnapshotConversionRow = {
  stage: ActiveStage;
  conversionToNext: number | null;
};

export async function getAssumptionsAnalysis(fromDate?: Date, toDate?: Date): Promise<AssumptionRow[]> {
  const [assumptions, deals] = await Promise.all([
    prisma.stageAssumption.findMany(),
    prisma.deal.findMany({
      select: { id: true, stage: true, status: true, stageEnteredAt: true },
    }),
  ]);

  const modelMap = new Map(assumptions.map((a) => [a.stage as string, a]));
  const today = new Date();

  // Filter deals by stageEnteredAt date range if provided
  const filteredDeals = deals.filter((d) => {
    if (!d.stageEnteredAt) return true; // include deals without stageEnteredAt
    const entered = new Date(d.stageEnteredAt);
    if (fromDate && entered < fromDate) return false;
    if (toDate && entered > toDate) return false;
    return true;
  });

  return STAGE_ORDER.map((stage) => {
    const model = modelMap.get(stage);
    const stageIdx = STAGE_ORDER.indexOf(stage);

    const atStage = filteredDeals.filter(
      (d) => d.stage === stage && (d.status === "active" || d.status === "stalled")
    );

    const laterStages = STAGE_ORDER.slice(stageIdx) as string[];
    const atOrPast = filteredDeals.filter(
      (d) =>
        laterStages.includes(d.stage ?? "") ||
        d.stage === "closed_won" ||
        d.stage === "lost"
    );
    const pastThisStage = filteredDeals.filter(
      (d) =>
        (STAGE_ORDER.slice(stageIdx + 1) as string[]).includes(d.stage ?? "") ||
        d.stage === "closed_won"
    );
    const actualConversionToNext =
      atOrPast.length > 0 ? pastThisStage.length / atOrPast.length : null;

    const daysValues = atStage
      .filter((d) => d.stageEnteredAt != null)
      .map((d) => (today.getTime() - new Date(d.stageEnteredAt!).getTime()) / 86400000);
    const actualAvgDaysInStage =
      daysValues.length > 0
        ? Math.round(daysValues.reduce((s, d) => s + d, 0) / daysValues.length)
        : null;

    return {
      stage,
      modelConversionToNext: model?.conversionToNext ?? 0,
      modelAvgDaysInStage: model?.avgDaysInStage ?? 0,
      actualConversionToNext,
      actualAvgDaysInStage,
      dealsAtStage: atStage.length,
    };
  });
}

export async function getSnapshotConversions(manifestId: string): Promise<SnapshotConversionRow[]> {
  const snapshots = await prisma.dealSnapshot.findMany({
    where: { manifestId },
    select: { stage: true, status: true },
  });

  return STAGE_ORDER.map((stage, stageIdx) => {
    const laterStages = STAGE_ORDER.slice(stageIdx) as string[];
    const atOrPast = snapshots.filter(
      (d) =>
        laterStages.includes(d.stage ?? "") ||
        d.stage === "closed_won" ||
        d.stage === "lost"
    );
    const pastThisStage = snapshots.filter(
      (d) =>
        (STAGE_ORDER.slice(stageIdx + 1) as string[]).includes(d.stage ?? "") ||
        d.stage === "closed_won"
    );
    return {
      stage,
      conversionToNext: atOrPast.length > 0 ? pastThisStage.length / atOrPast.length : null,
    };
  });
}
