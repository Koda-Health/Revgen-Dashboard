// src/lib/velocity-analysis.ts
import { prisma } from "@/lib/prisma";
import { NEW_LOGO_STAGE_ORDER, STAGE_LABELS } from "@/lib/stages";

// Trailing-window width applied at each evaluation point.
export type VelocityWindow = "3m" | "6m" | "9m" | "12m" | "lifetime";
export const VELOCITY_WINDOWS: VelocityWindow[] = ["3m", "6m", "9m", "12m", "lifetime"];

export type VelocityPoint = {
  date: string;               // ISO of the evaluation date (quarter end, capped at today)
  label: string;              // e.g. "Q1 '26"
  overallCycleDays: number | null;
  overallSampleSize: number;
  overallIsFallback: boolean; // true when using the time-in-pipeline fallback
  stages: Record<string, number | null>; // stage slug -> avg days in stage (null if none)
};

export type VelocityTrend = {
  window: VelocityWindow;
  stageOrder: { stage: string; label: string }[];
  points: VelocityPoint[];
};

const DAY_MS = 86_400_000;
const NUM_QUARTERS = 8;

// The last NUM_QUARTERS quarter-end evaluation dates; the most recent is capped at today.
function evaluationDates(now = new Date()): { date: Date; label: string }[] {
  const out: { date: Date; label: string }[] = [];
  let yy = now.getFullYear();
  let qq = Math.floor(now.getMonth() / 3); // 0..3
  for (let i = 0; i < NUM_QUARTERS; i++) {
    let end = new Date(yy, qq * 3 + 3, 0, 23, 59, 59, 999); // last day of the quarter
    if (end > now) end = new Date(now);                      // cap current quarter at today
    out.unshift({ date: end, label: `Q${qq + 1} '${String(yy).slice(2)}` });
    qq -= 1;
    if (qq < 0) { qq = 3; yy -= 1; }
  }
  return out;
}

function windowStart(evalDate: Date, window: VelocityWindow): Date | null {
  if (window === "lifetime") return null;
  const months: Record<Exclude<VelocityWindow, "lifetime">, number> = { "3m": 3, "6m": 6, "9m": 9, "12m": 12 };
  const d = new Date(evalDate);
  d.setMonth(d.getMonth() - months[window]);
  return d;
}

export async function getPipelineVelocityTrend(window: VelocityWindow): Promise<VelocityTrend> {
  const [transitions, deals] = await Promise.all([
    prisma.stageTransition.findMany({
      where: { pipeline: "new_logo", durationDays: { not: null }, exitedAt: { not: null } },
      select: { stage: true, durationDays: true, exitedAt: true },
    }),
    prisma.deal.findMany({
      where: { firstConvoDate: { not: null } },
      select: { firstConvoDate: true, closedWonDate: true, status: true },
    }),
  ]);

  const points: VelocityPoint[] = evaluationDates().map(({ date, label }) => {
    const start = windowStart(date, window);
    const inWindow = (t: Date) => t <= date && (start == null || t >= start);

    // Per-stage average of completed transitions whose exit falls in the window.
    const buckets = new Map<string, number[]>();
    for (const tr of transitions) {
      if (tr.durationDays == null || !tr.exitedAt || !inWindow(tr.exitedAt)) continue;
      const arr = buckets.get(tr.stage) ?? [];
      arr.push(tr.durationDays);
      buckets.set(tr.stage, arr);
    }
    const stages: Record<string, number | null> = {};
    for (const stage of NEW_LOGO_STAGE_ORDER) {
      const arr = buckets.get(stage) ?? [];
      stages[stage] = arr.length ? Math.round(arr.reduce((s, d) => s + d, 0) / arr.length) : null;
    }

    // Overall cycle: won deals whose close falls in the window.
    const wonCycles: number[] = [];
    for (const d of deals) {
      if (d.status !== "won" || !d.firstConvoDate || !d.closedWonDate || !inWindow(d.closedWonDate)) continue;
      const days = (d.closedWonDate.getTime() - d.firstConvoDate.getTime()) / DAY_MS;
      if (days >= 0) wonCycles.push(days);
    }

    let overallCycleDays: number | null;
    let overallSampleSize: number;
    let overallIsFallback = false;
    if (wonCycles.length > 0) {
      overallCycleDays = Math.round(wonCycles.reduce((s, d) => s + d, 0) / wonCycles.length);
      overallSampleSize = wonCycles.length;
    } else {
      // Fallback: average time in pipeline for all deals that had reached first convo by this date.
      const ages: number[] = [];
      for (const d of deals) {
        if (!d.firstConvoDate || d.firstConvoDate > date) continue;
        const endT = d.closedWonDate && d.closedWonDate <= date ? d.closedWonDate.getTime() : date.getTime();
        const days = (endT - d.firstConvoDate.getTime()) / DAY_MS;
        if (days >= 0) ages.push(days);
      }
      overallCycleDays = ages.length ? Math.round(ages.reduce((s, d) => s + d, 0) / ages.length) : null;
      overallSampleSize = ages.length;
      overallIsFallback = ages.length > 0;
    }

    return { date: date.toISOString(), label, overallCycleDays, overallSampleSize, overallIsFallback, stages };
  });

  const stageOrder = NEW_LOGO_STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABELS[stage] ?? stage }));
  return { window, stageOrder, points };
}
