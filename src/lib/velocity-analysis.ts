// src/lib/velocity-analysis.ts
import { prisma } from "@/lib/prisma";
import { NEW_LOGO_STAGE_ORDER, STAGE_LABELS } from "@/lib/stages";

export type Timeframe = "lifetime" | "3m" | "6m" | "9m" | "12m";
export const VELOCITY_TIMEFRAMES: Timeframe[] = ["lifetime", "3m", "6m", "9m", "12m"];

export type StageVelocity = {
  stage: string;
  label: string;
  avgDays: number | null;
  sampleSize: number;
};

export type VelocityData = {
  timeframe: Timeframe;
  overallCycleDays: number | null;
  overallSampleSize: number;
  stages: StageVelocity[];
};

function cutoffFor(timeframe: Timeframe): Date | null {
  if (timeframe === "lifetime") return null;
  const months: Record<Exclude<Timeframe, "lifetime">, number> = { "3m": 3, "6m": 6, "9m": 9, "12m": 12 };
  const d = new Date();
  d.setMonth(d.getMonth() - months[timeframe]);
  return d;
}

export async function getPipelineVelocity(timeframe: Timeframe): Promise<VelocityData> {
  const cutoff = cutoffFor(timeframe);

  // Per-stage average duration from completed (exited) transitions, new-logo only.
  const transitions = await prisma.stageTransition.findMany({
    where: {
      pipeline: "new_logo",
      durationDays: { not: null },
      exitedAt: cutoff ? { not: null, gte: cutoff } : { not: null },
    },
    select: { stage: true, durationDays: true },
  });

  const byStage = new Map<string, number[]>();
  for (const t of transitions) {
    if (t.durationDays == null) continue;
    const arr = byStage.get(t.stage) ?? [];
    arr.push(t.durationDays);
    byStage.set(t.stage, arr);
  }

  const stages: StageVelocity[] = NEW_LOGO_STAGE_ORDER.map((stage) => {
    const arr = byStage.get(stage) ?? [];
    const avgDays = arr.length > 0 ? Math.round(arr.reduce((s, d) => s + d, 0) / arr.length) : null;
    return { stage, label: STAGE_LABELS[stage] ?? stage, avgDays, sampleSize: arr.length };
  });

  // Overall sales cycle: firstConvoDate -> closedWonDate for won deals.
  const wonDeals = await prisma.deal.findMany({
    where: {
      status: "won",
      firstConvoDate: { not: null },
      closedWonDate: cutoff ? { not: null, gte: cutoff } : { not: null },
    },
    select: { firstConvoDate: true, closedWonDate: true },
  });

  const cycles: number[] = [];
  for (const d of wonDeals) {
    if (!d.firstConvoDate || !d.closedWonDate) continue;
    const days = (d.closedWonDate.getTime() - d.firstConvoDate.getTime()) / 86_400_000;
    if (days >= 0) cycles.push(days);
  }
  const overallCycleDays =
    cycles.length > 0 ? Math.round(cycles.reduce((s, d) => s + d, 0) / cycles.length) : null;

  return { timeframe, overallCycleDays, overallSampleSize: cycles.length, stages };
}
