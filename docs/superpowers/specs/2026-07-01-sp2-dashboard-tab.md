# SP2 - Dashboard Tab - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`
**Depends on:** SP1

## Changes

### 1. Remove "Top Deals by Value"

- Remove `<TopDealsSection>` from `src/app/(dashboard)/page.tsx`.
- Retire `src/components/dashboard/TopDealsSection.tsx` and the `topDeals` field from
  `DashboardData` (`src/lib/dashboard-data.ts`) once nothing else consumes it.

### 2. Revenue Waterfall chart (replaces Top Deals)

- **Depiction (confirmed):** a **weighted build-up waterfall**. Each new-logo pipeline stage
  contributes an incremental step equal to its weighted amount
  (`stagePipeline x overallCloseRate`), accumulating to the **total Weighted Forecast**.
  This visualizes revenue movement and pipeline progression by stage.
- Built with **Recharts** (already a dependency). Implemented as a stacked/floating bar
  waterfall (transparent "base" series + visible "delta" series) since Recharts has no native
  waterfall.
- New builder in `dashboard-data.ts`: `waterfallByStage` -> ordered array of
  `{ stage, label, pipeline, closeRate, weighted, cumulative }` following `NEW_LOGO_STAGE_ORDER`.
- New component `src/components/dashboard/RevenueWaterfall.tsx`:
  - Brand palette (teal/navy bars, coral/green accents per `CLAUDE.md`).
  - Hover tooltip: stage label, raw pipeline, close rate, weighted contribution, running total.
  - Responsive (`ResponsiveContainer`), smooth hover states, matches card styling
    (`bg-white rounded-card shadow-card p-6`).

### 3. Revenue vs Goal (FY) redesign

Refactor `src/components/dashboard/RevenueGoalCard.tsx` for executive readability:
- Convert the flat metric row into a clean **KPI grid** (large number + small uppercase
  label), per brand KPI-callout style.
- Clear hierarchy/grouping: Goal | Booked | Weighted Forecast | Gap | % of Goal, with better
  spacing/alignment and visual separation (dividers/cards), staying compact.
- **Preserve** all What-If controls (goal override, expected-from-existing override,
  include-weighted toggle, scenario badge, reset), the stacked progress bar, axis labels,
  and legend. Preserve responsiveness.

### 4. Apply SP1

- Dashboard drill-downs use the updated `DealTable` (Days in Stage + pace Status) automatically.

## Files

- Edit: `src/app/(dashboard)/page.tsx`, `src/lib/dashboard-data.ts`,
  `src/components/dashboard/RevenueGoalCard.tsx`
- New: `src/components/dashboard/RevenueWaterfall.tsx`
- Remove: `src/components/dashboard/TopDealsSection.tsx`

## Testing / verification

- Waterfall: steps sum to the Weighted Forecast KPI already shown on the dashboard.
- Revenue-vs-Goal: numbers unchanged vs current; What-If overrides still recompute; layout
  holds at mobile/tablet/desktop widths.

## Out of scope

- Changing weighted-forecast math (SP3 owns that; waterfall consumes whatever the forecast
  produces).
