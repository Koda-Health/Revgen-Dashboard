// src/lib/close-rate.ts
// Pure utility — no DB imports, safe in client components.
// overallCloseRate = cumulative product of conversionToNext from a stage through
// the last stage of its pipeline chain. The renewal "At Risk" stage is NOT part
// of any chain; its rate comes solely from closeRateOverride.

import { NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER } from "@/lib/stages";

export { NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER };

/**
 * Derive each chain stage's overall close rate from per-stage conversion rates.
 * closeRate[i] = product of conversionToNext[j] for j >= i (through chain end).
 * `order` is the funnel chain for one pipeline. Missing rates treated as 0.
 */
export function deriveCloseRates(
  rows: { stage: string; conversionToNext: number }[],
  order: readonly string[],
): Map<string, number> {
  const convMap = new Map(rows.map((r) => [r.stage, r.conversionToNext]));
  const result = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    let product = 1;
    for (let j = i; j < order.length; j++) {
      product *= convMap.get(order[j]) ?? 0;
    }
    result.set(order[i], product);
  }
  return result;
}

export function effectiveCloseRate(
  derived: number,
  override: number | null | undefined,
): number {
  return override != null ? override : derived;
}
