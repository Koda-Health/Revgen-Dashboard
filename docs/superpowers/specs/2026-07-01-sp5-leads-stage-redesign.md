# SP5 - Leads Stage Redesign - Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Branch:** `feat/dashboard-updates-2026-07`
**Risk:** High (schema + Attio mapping + migration)

## Problem

Replace the lead-stage taxonomy. Source is unchanged: the company-level **Company Stage**
field (Attio `activation`). Only the value set changes.

## New taxonomy (ordered)

`unaware -> outreach -> aware -> engaged -> discovery_meeting_set -> discovery_meeting_complete`

Attio title -> slug mapping (to confirm exact Attio titles during build):
- "Unaware" -> `unaware`
- "Outreach" -> `outreach`
- "Aware" -> `aware`
- "Engaged" -> `engaged`
- "Discovery Meeting Set" -> `discovery_meeting_set`
- "Discovery Meeting Complete" -> `discovery_meeting_complete`

## Schema

- `CompanyStage` enum -> the six new values.
- **Retain** deprecated values (`opportunity`, `customer`, `evangelist`) in the enum for
  historical rows (preserve compatibility); never written after re-sync.
- Prisma migration required (additive enum values + code-level remapping). No destructive
  history rewrite.

## Attio mapping

- Rewrite `COMPANY_STAGE_MAP` in `src/lib/attio.ts` to the new titles/slugs.

## Metrics / data layer (`src/lib/leads-data.ts`)

- `LEAD_STAGES` = all six new stages (all are pre-pipeline lead stages).
- **Converted metric redefinition (confirmed):** "converted" = company has an associated deal
  that reached `first_convo`+ (stage-taxonomy-independent), replacing the old
  `opportunity/customer/evangelist` test.
- Update stage-order maps (`STAGE_ORDER_MAP`, drill-down grouping) to the new order.
- Update filters/funnels/counts that key off company stage.

## Labels / UI

- `COMPANY_STAGE_LABELS` (in `src/lib/format.ts`) -> new labels.
- `StagePill` styles for the new company-stage slugs (cool -> warm progression).
- Add **Days in Stage** to lead drill-down views where applicable (`LeadTable`); note leads
  are company-level, so "days in stage" uses the company/deal stage-entry data available.

## Files

- Edit: `prisma/schema.prisma` (+ migration), `src/lib/attio.ts`, `src/lib/format.ts`,
  `src/lib/leads-data.ts`, `src/components/leads/LeadsChartsSection.tsx`,
  `src/components/leads/LeadTable.tsx`, `src/components/ui/StagePill.tsx`

## Testing / verification

- Re-sync maps Attio activation values to new slugs; leads charts/funnel render the six
  stages in order; converted metric reflects deal-based definition.
- Historical company rows with deprecated stages still render (no crash, labeled).

## Open items to confirm during build

- Exact Attio option titles for the new stages (must match `activation` field options).
- Whether any KPI copy referencing "converted to first convo" needs wording updates.
