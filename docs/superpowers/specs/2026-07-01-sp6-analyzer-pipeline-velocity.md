# SP6 - Analyzer Pipeline Velocity Chart - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`

## Problem

Add an executive-grade, interactive Pipeline Velocity chart to the Analyzer, showing how long
deals take across the funnel, with timeframe and series toggles - computed dynamically from
historical data.

## Decision (confirmed)

Store per-stage transition history from Attio via a sync step, enabling true individual-stage
durations over any timeframe.

## Data model

New table `StageTransition`:
```
model StageTransition {
  id           String   @id @default(uuid())
  dealId       String
  stage        String   // raw slug
  pipeline     Pipeline
  enteredAt    DateTime
  exitedAt     DateTime?   // null = current stage
  durationDays Int?        // computed when exited
  deal         Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  @@index([dealId])
  @@index([stage])
  @@index([exitedAt])
}
```
- Prisma migration required. `Deal` gains the back-relation.

## Sync

- `src/lib/attio.ts`: extend `fetchDealStageHistory` usage to emit **all** transitions
  (`active_from`/`active_until` -> `enteredAt`/`exitedAt`), not just first-convo derivation.
- `src/app/api/sync/backfill/route.ts` + `src/lib/run-sync.ts`: upsert `StageTransition`
  rows for each deal (replace-on-resync per deal to stay idempotent).

## Aggregation

New `src/lib/velocity-analysis.ts`:
- `getPipelineVelocity(timeframe)` returns:
  - **Overall sales cycle**: avg `firstConvoDate -> closedWonDate` for won deals in range.
  - **Per-stage durations**: avg `durationDays` grouped by stage, from completed transitions.
  - Optional stage-to-stage timing where supported by the data.
- **Timeframe filter** on `exitedAt` (or won date): Lifetime / Trailing 3 / 6 / 9 / 12 months.
- Averages computed dynamically; reusable + performant (indexed queries, aggregate in SQL/JS).

## UI

New `src/components/analyzer/PipelineVelocityChart.tsx`:
- **Timeframe toggle:** Lifetime | 3M | 6M | 9M | 12M.
- **Series toggles:** Overall cycle; individual stage durations (each stage on/off);
  stage-to-stage metrics if available.
- Recharts, `ResponsiveContainer`, brand palette, smooth interactive filtering, tooltips.
- Added to `src/components/analyzer/AnalyzerClientSection.tsx`. Data fetched via a new
  analyzer API route (`/api/analyzer/velocity`) or server prop, consistent with existing
  analyzer patterns.

## Files

- Edit: `prisma/schema.prisma` (+ migration), `src/lib/attio.ts`,
  `src/app/api/sync/backfill/route.ts`, `src/lib/run-sync.ts`,
  `src/components/analyzer/AnalyzerClientSection.tsx`
- New: `src/lib/velocity-analysis.ts`,
  `src/components/analyzer/PipelineVelocityChart.tsx`,
  `src/app/api/analyzer/velocity/route.ts`

## Testing / verification

- After backfill, `StageTransition` rows exist for deals with Attio history.
- Toggling timeframe/series updates the chart; averages match a manual spot-check.
- Large-dataset performance acceptable (indexed `exitedAt`, aggregate queries).

## Out of scope

- Rewriting existing cohort/snapshot analyzer features.
