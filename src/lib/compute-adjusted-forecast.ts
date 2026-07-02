// src/lib/compute-adjusted-forecast.ts
// Pure utility - no server imports, safe to use in client components.

import { NEW_LOGO_STAGE_ORDER, IMPLEMENTATION_LAG_DAYS } from "@/lib/stages";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DateSource = "projected" | "koda";

export type WeightedForecastDeal = {
  id: string;
  name: string;
  companyName: string | null;
  stage: string;
  value: number;
  closeRate: number;
  projectedCloseDate: string;           // ISO - computed from stage assumptions
  kodaExpectedCloseDate: string | null; // ISO - manually entered (Koda) date, if any
  timingFactor: number;                 // default (projected-date) timing factor
  contribution: number;                 // default (projected-date) contribution
};

export type DealOverride = {
  excluded?: boolean;
  dateOverride?: string;   // YYYY-MM-DD
  valueOverride?: number;
  dateSource?: DateSource; // per-deal choice of which close date drives timing (default "projected")
};

export type AdjustedForecastDeal = WeightedForecastDeal & {
  adjustedValue: number;
  adjustedCloseRate: number;
  adjustedTimingFactor: number;
  adjustedContribution: number;
  effectiveCloseDate: string; // ISO or YYYY-MM-DD actually used for timing
  dateSource: DateSource;
  excluded: boolean;
  hasDateOverride: boolean;
  hasValueOverride: boolean;
};

// Minimal shapes (structural - avoids coupling to Prisma types in this client-safe module).
export type ForecastAssumption = {
  stage: string;
  overallCloseRate: number;
  avgDaysInStage: number;
};

export type ForecastDealInput = {
  id: string;
  name: string;
  companyName: string | null;
  stage: string;
  value: number;
  expectedClosedDate: Date | string | null; // manual Koda date
};

/**
 * Projected close date = today + sum(avgDaysInStage for the current stage through the
 * last active stage). Implementation lag is applied later (timing), not here.
 */
export function computeProjectedCloseDate(
  stage: string,
  avgDaysByStage: Map<string, number>,
  today: Date = new Date(),
): Date {
  const idx = (NEW_LOGO_STAGE_ORDER as readonly string[]).indexOf(stage);
  const remaining = idx === -1 ? [] : (NEW_LOGO_STAGE_ORDER as readonly string[]).slice(idx);
  const days = remaining.reduce((s, st) => s + (avgDaysByStage.get(st) ?? 0), 0);
  return new Date(today.getTime() + days * DAY_MS);
}

/**
 * In-year timing factor for a close date: fraction of the fiscal year remaining after the
 * close date + IMPLEMENTATION_LAG_DAYS. Clamped to [0,1].
 */
export function computeTimingFactor(closeDate: Date, year: number): number {
  const fyStart = new Date(`${year}-01-01T00:00:00`);
  const fyEnd = new Date(`${year}-12-31T23:59:59`);
  const yearMs = fyEnd.getTime() - fyStart.getTime();
  if (yearMs <= 0) return 0;
  const revenueStart = new Date(closeDate.getTime() + IMPLEMENTATION_LAG_DAYS * DAY_MS);
  const remainingMs = Math.max(0, fyEnd.getTime() - revenueStart.getTime());
  return Math.min(1, remainingMs / yearMs);
}

/**
 * Build the weighted-forecast breakdown for a set of new-logo deals.
 * Default timing uses each deal's PROJECTED close date; the manual "Koda" date is carried
 * alongside so the UI can toggle per deal. A deal is included when its projected close date
 * OR its Koda date lands on/before fiscal year-end.
 */
export function buildWeightedForecastBreakdown(
  deals: ForecastDealInput[],
  assumptions: ForecastAssumption[],
  year: number,
  today: Date = new Date(),
): WeightedForecastDeal[] {
  const rateMap = new Map(assumptions.map((a) => [a.stage, a.overallCloseRate]));
  const avgDaysByStage = new Map(assumptions.map((a) => [a.stage, a.avgDaysInStage]));
  const fyEnd = new Date(`${year}-12-31T23:59:59`);

  const out: WeightedForecastDeal[] = [];
  for (const d of deals) {
    if (!d.stage || !d.value) continue;
    const closeRate = rateMap.get(d.stage) ?? 0;

    const projected = computeProjectedCloseDate(d.stage, avgDaysByStage, today);
    const koda = d.expectedClosedDate ? new Date(d.expectedClosedDate) : null;

    const projectedInFy = projected <= fyEnd;
    const kodaInFy = koda != null && koda <= fyEnd;
    if (!projectedInFy && !kodaInFy) continue;

    const timingFactor = computeTimingFactor(projected, year);
    const contribution = d.value * closeRate * timingFactor;

    out.push({
      id: d.id,
      name: d.name,
      companyName: d.companyName,
      stage: d.stage,
      value: d.value,
      closeRate,
      projectedCloseDate: projected.toISOString(),
      kodaExpectedCloseDate: koda ? koda.toISOString() : null,
      timingFactor,
      contribution,
    });
  }
  out.sort((a, b) => b.contribution - a.contribution);
  return out;
}

function parseCloseDate(s: string): Date {
  // ISO strings contain "T"; date-only overrides (YYYY-MM-DD) are read at local midnight.
  return s.includes("T") ? new Date(s) : new Date(s + "T00:00:00");
}

/**
 * Recompute the weighted forecast applying per-deal overrides and global modifiers.
 *
 * Effective close date per deal: custom dateOverride wins; else the deal's dateSource
 * ("projected" default, or "koda" manual date, falling back to projected if none).
 *
 * Close-rate modifier (+20 -> x1.20): adjustedCloseRate = closeRate x (1 + m/100), clamped.
 * Timing modifier (+20 = 20% longer -> lower factor): applied ONLY to projected-default
 * timing; when an explicit date is used (koda or custom override), timing is recomputed
 * directly from that date.
 */
export function computeAdjustedForecast(
  breakdown: WeightedForecastDeal[],
  dealOverrides: Record<string, DealOverride>,
  closeRateModifier: number,
  timingModifier: number,
  year: number,
): { deals: AdjustedForecastDeal[]; total: number } {
  const deals: AdjustedForecastDeal[] = breakdown.map((deal) => {
    const override = dealOverrides[deal.id] ?? {};
    const excluded = override.excluded === true;
    const hasValueOverride = override.valueOverride !== undefined && override.valueOverride !== null;
    const hasDateOverride = !!override.dateOverride;
    const dateSource: DateSource = override.dateSource ?? "projected";

    const adjustedValue = hasValueOverride ? override.valueOverride! : deal.value;

    const adjustedCloseRate = Math.min(1, Math.max(0,
      deal.closeRate * (1 + closeRateModifier / 100),
    ));

    // Determine the effective close date.
    let effectiveCloseDate: string;
    if (hasDateOverride) {
      effectiveCloseDate = override.dateOverride!;
    } else if (dateSource === "koda") {
      effectiveCloseDate = deal.kodaExpectedCloseDate ?? deal.projectedCloseDate;
    } else {
      effectiveCloseDate = deal.projectedCloseDate;
    }

    // Timing factor.
    let adjustedTimingFactor: number;
    const usesExplicitDate = hasDateOverride || dateSource === "koda";
    if (usesExplicitDate) {
      adjustedTimingFactor = computeTimingFactor(parseCloseDate(effectiveCloseDate), year);
    } else {
      adjustedTimingFactor = Math.min(1, Math.max(0,
        deal.timingFactor * (1 - timingModifier / 100),
      ));
    }

    const adjustedContribution = excluded
      ? 0
      : adjustedValue * adjustedCloseRate * adjustedTimingFactor;

    return {
      ...deal,
      adjustedValue,
      adjustedCloseRate,
      adjustedTimingFactor,
      adjustedContribution,
      effectiveCloseDate,
      dateSource,
      excluded,
      hasDateOverride,
      hasValueOverride,
    };
  });

  const total = deals.reduce((s, d) => s + d.adjustedContribution, 0);
  return { deals, total };
}
