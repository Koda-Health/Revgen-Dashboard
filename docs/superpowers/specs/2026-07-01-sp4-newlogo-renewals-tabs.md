# SP4 - New Logo + Renewals Tabs - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`
**Depends on:** SP1

## New Logo tab

- Apply SP1: drill-down tables use the updated `DealTable` (Days in Stage + pace Status).
  Mostly automatic once `pipeline-data.ts` populates `paceStatus` (done in SP1).

## Renewals tab

- **Remove the "By Deal Type" and "By Source" charts** from the Renewals view.
- `src/components/pipeline/PipelineBarCharts.tsx` is shared by both pipelines. Make it
  **variant-aware**:
  - accept `variant?: "new_logo" | "renewal"` (already threaded through
    `PipelineClientSection`).
  - `new_logo`: render all four charts (Stage, Source, Company Type, Deal Type) - unchanged.
  - `renewal`: render only **By Stage** + **By Company Type** in a clean 2-column grid; no
    empty cells or awkward gaps.
- `src/components/pipeline/PipelineClientSection.tsx`: pass `variant` into `PipelineBarCharts`.

## Files

- Edit: `src/components/pipeline/PipelineBarCharts.tsx`,
  `src/components/pipeline/PipelineClientSection.tsx`

## Testing / verification

- Renewals shows exactly two charts, balanced; New Logo still shows four.
- Drill-downs in both tabs show Days in Stage + pace Status.

## Out of scope

- Renewal-specific stage benchmarks (uses the same `avgDaysInStage` assumptions).
