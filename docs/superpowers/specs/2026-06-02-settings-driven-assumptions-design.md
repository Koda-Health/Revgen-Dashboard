# Settings-Driven Stage Assumptions — Design

**Date:** 2026-06-02
**Status:** Approved
**Branch:** `feat/settings-driven-assumptions`

## Problem

The per-stage `overallCloseRate` that drives the Dashboard weighted forecast and the
Leads pipeline blueprint is currently sourced exclusively from a daily Google Sheets
sync (`'Pipeline funnel math - 2026'` tab). The Settings tab can edit `conversionToNext`
and `avgDaysInStage` but **not** the close rate, and a daily cron overwrites any local
edits. We want the Settings tab to be the single source of truth and to retire the sheet.

## Goals

1. Remove the Google Sheets sync entirely.
2. Make the Settings tab the source of truth for stage assumptions.
3. Derive `overallCloseRate` from the Settings-tab conversion rates, with an optional
   manual per-stage override.
4. Confirm the Analyzer "Assumptions Analysis" model and the Leads pipeline math both
   consume these Settings-driven assumptions.

## Decisions (confirmed)

- **Close rate = derived, with optional override.** Effective close rate per stage =
  `closeRateOverride ?? derived`.
- **Adopt derived immediately** — no backfill of overrides. On first deploy, close rates
  recompute from the existing conversion rates; displayed forecast numbers may shift, and
  that is expected/desired.
- **Full removal** of the Sheets sync (code, cron, Sources tile, env, deps).
- **Analyzer unchanged** — it already reads model values live from the DB.

## Close-Rate Model

Active stage order: `first_convo → opp_qual → stakeholder → verbal → contracting`.

Derived close rate for stage *i* = cumulative product of `conversionToNext` from stage *i*
through `contracting`:

- `contracting` = `conv[contracting]`
- `verbal` = `conv[verbal] × conv[contracting]`
- `stakeholder` = `conv[stakeholder] × conv[verbal] × conv[contracting]`
- `opp_qual` = `conv[opp_qual] × … × conv[contracting]`
- `first_convo` = product of all five

Effective close rate = `closeRateOverride` if set, else derived. `closed_won` / `lost`
stages do not participate (not used by the forecast).

### Storage strategy

Keep the existing `overallCloseRate` column as a **materialized effective value**,
recomputed and persisted on every Settings save. This leaves the three consumers
(dashboard-data, leads-data, blueprint client) **unchanged** — they keep reading
`overallCloseRate`. After the sheet is removed, the Settings PATCH is the only writer, so
the materialized value cannot go stale. Derivation logic lives in one shared helper.

## Components / Changes

### New: `src/lib/close-rate.ts`
- `deriveCloseRates(rows: { stage: string; conversionToNext: number }[]): Map<string, number>`
  — cumulative-product close rate per active stage.
- `effectiveCloseRate(derived: number, override: number | null | undefined): number`.

### Schema + migration (`prisma/schema.prisma`)
- Add `closeRateOverride Float?` to `StageAssumption`.
- Migration adds the nullable column. No data backfill (adopt-derived-immediately).

### Settings API (`src/app/api/settings/assumptions/route.ts`)
- `GET` returns `closeRateOverride`.
- `PATCH` accepts `closeRateOverride` (nullable) per active stage. After applying
  `conversionToNext` / `avgDaysInStage` / `closeRateOverride`, recompute the effective
  close rate for the five active stages via `deriveCloseRates` + `effectiveCloseRate` and
  persist into `overallCloseRate`.

### Settings UI (`src/components/settings/StageAssumptionsSection.tsx`)
- Add an **Overall Close Rate** column: live-derived value (recomputed client-side as
  conversion rates change) with an optional override input per active stage (blank = use
  derived).
- Send `closeRateOverride` on save.
- Remove all "Google Sheets sync will overwrite" copy.

### Remove Sheets sync (full)
- Delete `src/app/api/sync/sheets/route.ts` and `src/lib/sheets.ts`.
- `src/lib/run-sync.ts`: remove `runSheetsSync`, `SheetsSyncResult`, and the
  `fetchSheetAssumptions` import.
- `src/app/api/sources/sync/route.ts`: remove the `source === "sheets"` branch and the
  `runSheetsSync` import.
- `src/app/api/sources/status/route.ts` + `src/app/(dashboard)/sources/page.tsx`: drop the
  `SYNC_SHEETS` lookup and the "Google Sheets" source tile.
- `src/components/sources/SyncStatusGrid.tsx`: remove the `sheets` formatter.
- `src/components/sources/SyncHistoryTable.tsx`: remove the `SYNC_SHEETS` label/formatter.
- `vercel.json`: remove the `/api/sync/sheets` cron entry.
- `.env.example`: remove `GOOGLE_SHEETS_ID` and `GOOGLE_SERVICE_ACCOUNT`.
- `package.json`: remove `googleapis` and `@googleapis/sheets` (only used by `sheets.ts`).
- Historical `SYNC_SHEETS` audit-log rows remain in the DB; the UI simply stops
  referencing them.

### Leads tab & Analyzer
- **Leads blueprint:** no code change. Already reads `overallCloseRate` + `avgDaysInStage`
  from the table. Verify end-to-end.
- **Analyzer:** no change.

## Verification

- Unit-verify `deriveCloseRates` with a throwaway `tsx` assertion script (no test
  framework exists in this repo; not introducing one for this change).
- `npm run lint` and `npm run build` (includes `prisma generate` + typecheck) pass.
- Manual: edit a conversion rate in Settings → derived close rate updates → save → Dashboard
  weighted forecast and Leads blueprint reflect the new rate. Set an override → forecast
  uses the override.
- Confirm no remaining references to sheets sync (`grep -ri "sheets" src`).

## Out of Scope

- Test-framework introduction.
- Changes to the Analyzer view.
- Removing historical `SYNC_SHEETS` audit-log rows.
