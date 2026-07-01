# SP3 - Weighted Forecast Logic - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`

## Problem

Weighted-forecast timing relies on manually entered expected close dates. It should default
to **stage-based projected timing**, while still allowing the manual date per deal.

## Decisions (confirmed)

- Add a computed **Projected Close Date** from stage assumptions.
- **Rename the display label** "Expected Close" -> **"Koda Expected Close Date"**. Keep the DB
  column `expectedClosedDate` (display-only rename; backwards compatible).
- **Per-deal toggle** choosing Projected vs Koda Expected, **defaulting all deals to Projected**.

## Projected Close Date

```
projectedCloseDate(deal) =
  today + sum( avgDaysInStage[s] for s in stages from deal.stage .. last active stage )
```
- Implemented as a pure util (extend `src/lib/compute-adjusted-forecast.ts` or new
  `src/lib/forecast-dates.ts`). Uses `NEW_LOGO_STAGE_ORDER` + the `StageAssumption` map.
- Dynamically recomputes as assumptions/stage change. Transparent + traceable (documented
  formula, same style as existing forecast notes).

## Effective date + timing

- The **effective close date** for each deal = Projected (default) or Koda Expected, per the
  deal's toggle. Timing factor is derived from the effective date + `IMPLEMENTATION_LAG_DAYS`
  (existing logic), instead of always using `expectedClosedDate`.
- Deals with a stage but no manual date now enter the forecast via their projected date
  (intended coverage expansion).

## Toggle plumbing

- Extend the scenario overrides (`src/lib/use-scenario.ts`, `DealOverride` in
  `compute-adjusted-forecast.ts`) with `dateSource?: "projected" | "koda"`; absence = default
  (Projected).
- `computeAdjustedForecast` selects the effective date from `dateSource`. Existing per-deal
  `dateOverride` (custom date) still wins when set.
- `WeightedForecastModal.tsx`: add a per-row Projected/Koda toggle; show both dates; relabel
  the column to "Koda Expected Close Date"; update the formula note.

## Centralization cleanup

- The weighted-forecast breakdown builder is duplicated in `dashboard-data.ts` and
  `leads-data.ts`. Extract one shared builder (e.g. `buildWeightedForecastBreakdown`) that
  emits `WeightedForecastDeal` including both `projectedCloseDate` and
  `kodaExpectedCloseDate` (renamed carrier of `expectedClosedDate`), and use it in both.
- `WeightedForecastDeal` gains `projectedCloseDate: string` and keeps the manual date under a
  clearly named field; keep `expectedClosedDate` as an alias if needed for compatibility.

## Files

- New/extend: `src/lib/forecast-dates.ts` (or extend `compute-adjusted-forecast.ts`)
- Edit: `src/lib/compute-adjusted-forecast.ts`, `src/lib/dashboard-data.ts`,
  `src/lib/leads-data.ts`, `src/lib/use-scenario.ts`,
  `src/components/dashboard/WeightedForecastModal.tsx`,
  `src/components/dashboard/RevenueGoalCard.tsx` (label only)

## Testing / verification

- Projected date math: a deal at `first_convo` projects ~= today + sum of all stage avgs.
- Default forecast (all Projected) recomputes; flipping a deal to Koda Expected uses the
  manual date; custom `dateOverride` still overrides.
- Dashboard + Leads weighted totals match after centralizing the builder (no drift).

## Out of scope

- Renaming the physical DB column. Renewal forecast timing (remains untimed per prior design).
