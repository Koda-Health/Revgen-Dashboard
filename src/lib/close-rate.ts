// src/lib/close-rate.ts
// Pure utility — no DB imports, safe to use in client components.
//
// The per-stage "overall close rate" is the probability a deal at that stage
// eventually reaches Closed Won. It is the cumulative product of the per-stage
// "conversion to next" rates from that stage through Contracting (funnel math).

// Active pipeline stages, in funnel order. closed_won / lost do not participate.
export const ACTIVE_STAGE_ORDER = [
  "first_convo",
  "opp_qual",
  "stakeholder",
  "verbal",
  "contracting",
] as const;

export type ActiveStage = (typeof ACTIVE_STAGE_ORDER)[number];

/**
 * Derive each active stage's overall close rate from the per-stage conversion
 * rates. closeRate[stage_i] = product of conversionToNext[stage_j] for j >= i
 * (through the final active stage).
 *
 * Missing conversion rates are treated as 0. Returns a Map keyed by stage slug;
 * only active stages are included.
 */
export function deriveCloseRates(
  rows: { stage: string; conversionToNext: number }[],
): Map<string, number> {
  const convMap = new Map(rows.map((r) => [r.stage, r.conversionToNext]));
  const result = new Map<string, number>();

  for (let i = 0; i < ACTIVE_STAGE_ORDER.length; i++) {
    let product = 1;
    for (let j = i; j < ACTIVE_STAGE_ORDER.length; j++) {
      product *= convMap.get(ACTIVE_STAGE_ORDER[j]) ?? 0;
    }
    result.set(ACTIVE_STAGE_ORDER[i], product);
  }

  return result;
}

/**
 * Effective close rate for a stage: the manual override if one is set,
 * otherwise the derived value.
 */
export function effectiveCloseRate(
  derived: number,
  override: number | null | undefined,
): number {
  return override != null ? override : derived;
}
