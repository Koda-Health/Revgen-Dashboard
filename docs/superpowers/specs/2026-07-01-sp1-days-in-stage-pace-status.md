# SP1 - Days in Stage + Pace Status Engine (shared) - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`

## Problem

Every click-in detail table/modal should show how long a deal has sat in its current
stage and whether that pace is healthy relative to the stage benchmark. The logic must be
centralized (used by Dashboard, New Logo, Renewals, Leads) and driven by configurable data,
not hardcoded thresholds.

## Decisions

- **Benchmark source:** `StageAssumption.avgDaysInStage` (already configurable in Settings).
- **Pace Status replaces the lifecycle Status column** in `DealTable`. Lifecycle status
  (active/won/lost/stalled) remains visible in `DealDetailModal`.
- **Thresholds are configurable** via one exported constant.

## Pace status logic

New pure module `src/lib/stage-pace.ts` (no server imports; safe in client + server):

```ts
export type PaceStatus = "on_track" | "watch" | "stalled" | "no_benchmark";

export const PACE_THRESHOLDS = {
  watchMultiplier: 1.0,   // > avg          -> watch
  stalledMultiplier: 1.5, // > 1.5x avg     -> stalled
} as const;

export function computePaceStatus(
  daysInStage: number | null,
  avgDaysInStage: number | null | undefined,
  thresholds = PACE_THRESHOLDS,
): PaceStatus;
```

Rules:
- `no_benchmark` when `avgDaysInStage` is null/undefined/0, or `daysInStage` is null.
- `stalled` when `daysInStage > avg * stalledMultiplier`.
- `watch` when `daysInStage > avg * watchMultiplier` (and not stalled).
- `on_track` otherwise (`daysInStage <= avg`).

Also export `PACE_LABELS` and a helper mapping status -> label for reuse.

## Data-layer wiring

- Extend `DealRow` (`src/components/ui/DealTable.tsx`) with:
  - `paceStatus: PaceStatus`
  - (keep existing `daysInStage`, `status`)
- Compute `paceStatus` where `DealRow`s are built, passing the stage's `avgDaysInStage`
  from the loaded `StageAssumption`s:
  - `src/lib/dashboard-data.ts` (topDeals + any drilldown rows)
  - `src/lib/pipeline-data.ts` (New Logo + Renewals drilldowns)
- A small server helper (e.g. `buildDealRow(deal, assumptionMap, today)`) removes duplication
  across the data layers.

## UI

- `src/components/ui/StagePill.tsx`: add `type="pace"` rendering brand-aligned badges:
  - on_track -> green (`bg-green-100 text-green-800`)
  - watch -> amber (`bg-amber-50 text-amber-700`)
  - stalled -> rose (`bg-rose-50 text-rose-700`)
  - no_benchmark -> slate (`bg-slate-100 text-slate-600`)
  - Labels: "On Track", "Watch", "Stalled", "No Benchmark".
- `src/components/ui/DealTable.tsx`:
  - Add a **"Days in Stage"** column (renders `daysInStage` as `Nd`, `-` when null).
  - **Replace** the lifecycle Status column with the pace Status badge.
- `src/components/dashboard/DealDetailModal.tsx`:
  - Keep lifecycle Status field; add explicit **Pace** field showing the pace badge; keep
    the existing Days in Stage field.

## Files

- New: `src/lib/stage-pace.ts`
- Edit: `src/components/ui/StagePill.tsx`, `src/components/ui/DealTable.tsx`,
  `src/components/dashboard/DealDetailModal.tsx`, `src/lib/dashboard-data.ts`,
  `src/lib/pipeline-data.ts`

## Testing / verification

- Unit-style checks for `computePaceStatus` across all four branches + boundary cases
  (daysInStage exactly == avg -> on_track; == 1.5x avg -> watch; just over -> stalled).
- Visual: drill into a stage in New Logo/Renewals/Dashboard; confirm Days in Stage column
  and pace badges render; deals in stages with no `avgDaysInStage` show "No Benchmark".

## Out of scope

- Making thresholds editable from the Settings UI (constant is easily editable in code; a
  Settings control can be a later enhancement).
