// src/lib/stage-pace.ts
// Single source of truth for "pace" status: how a deal's time-in-stage compares to the
// configured stage benchmark (StageAssumption.avgDaysInStage). Pure module - no server
// imports, safe to use in both server data layers and client components.

export type PaceStatus = "on_track" | "watch" | "stalled" | "no_benchmark";

// Editable thresholds. `watch` triggers above the benchmark; `stalled` above 1.5x.
export const PACE_THRESHOLDS = {
  watchMultiplier: 1.0, // daysInStage > avg * 1.0  -> watch
  stalledMultiplier: 1.5, // daysInStage > avg * 1.5  -> stalled
} as const;

export type PaceThresholds = typeof PACE_THRESHOLDS;

export const PACE_LABELS: Record<PaceStatus, string> = {
  on_track: "On Track",
  watch: "Watch",
  stalled: "Stalled",
  no_benchmark: "No Benchmark",
};

/**
 * Classify a deal's pace in its current stage against the stage benchmark.
 *
 * - no_benchmark: benchmark missing/zero, or daysInStage unknown
 * - stalled:      daysInStage > avg * stalledMultiplier
 * - watch:        daysInStage > avg * watchMultiplier (and not stalled)
 * - on_track:     daysInStage <= avg
 */
export function computePaceStatus(
  daysInStage: number | null | undefined,
  avgDaysInStage: number | null | undefined,
  thresholds: PaceThresholds = PACE_THRESHOLDS,
): PaceStatus {
  if (avgDaysInStage == null || avgDaysInStage <= 0) return "no_benchmark";
  if (daysInStage == null) return "no_benchmark";
  if (daysInStage > avgDaysInStage * thresholds.stalledMultiplier) return "stalled";
  if (daysInStage > avgDaysInStage * thresholds.watchMultiplier) return "watch";
  return "on_track";
}
