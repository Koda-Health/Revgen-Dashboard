# New-Logo & Renewal Pipeline Restructure — Design

**Date:** 2026-06-16
**Status:** Draft (pending review)
**Branch:** `feat/settings-driven-assumptions` (continuing) → new branch recommended

## Problem

Attio's `Deal stage` field was restructured. The single 5-active-stage funnel
(`first_convo → opp_qual → stakeholder → verbal → contracting`) has been replaced by
**two distinct pipelines** sharing one Attio `deals` object, distinguished by stage label:

- **New Logo** — 10 active stages (First Conversation … Contract in Signatures) + `Closed-Won` / `Lost`.
- **Renewal** (incl. expansions) — 7 active stages (Opportunity Identified … Contracting), an
  out-of-band **At Risk** stage, + `Renewal - Renewed` (won) / `Renewal - Churn/Lost` (lost).

The RevGen dashboard hardcodes the old 5-stage funnel in several places and blends all deal
types into one view. It needs to (1) adopt the new stages, (2) present the two pipelines as
separate views, and (3) reflect new close-rate and days-in-stage assumptions.

## Decisions (confirmed with stakeholder)

1. **Two separate views**, not a toggle: rename **Pipeline → "New Logo Deals"**, add a new
   **"Renewal Deals"** tab. Routing is by **stage prefix** (`Renewal - …` → Renewal pipeline).
2. **Close-rate model unchanged (Option B):** `conversionToNext` stays the source of truth;
   `overallCloseRate` is the cumulative product (existing engine). Per-stage manual override
   (`closeRateOverride`) still supported.
3. **At Risk is an out-of-band stage:** pinned `closeRateOverride = 25%`, **excluded from the
   renewal cumulative-product chain**.
4. **Renewal forecast is display-only / decoupled** from the revenue-goal math. The flat
   `expectedFromExisting` fiscal lever is unchanged. Renewal weighted forecast is **untimed**
   (`value × closeRate`, no in-year proration, no implementation lag).
5. **Dashboard combines for display only** — combined + broken-out widgets; goal/coverage/
   %-to-goal math stays New-Logo + flat `expectedFromExisting`.
6. **Leads tab & goal math stay New-Logo-focused.**
7. **New-logo implementation lag 60 → 45 days.**
8. **History left as-is:** Analyzer/cohort snapshots store raw stage slugs from capture time;
   pre-migration cohorts render with old stages, post-migration with new. No history rewrite.

## Canonical stage definitions

A new module `src/lib/stages.ts` becomes the **single source of truth** for stage slugs,
ordering, pipeline membership, and Attio-title mapping — replacing the three divergent arrays
in `close-rate.ts`, `calculations.ts`, and `pipeline-data.ts`.

### New Logo (slug → Attio title)

| Order | Slug | Attio title |
|--:|---|---|
| 1 | `first_convo` | First Conversation |
| 2 | `stakeholder_meeting_set` | Stakeholder Meeting Set |
| 3 | `stakeholder_meeting_complete` | Stakeholder Meeting Complete |
| 4 | `building_business_case` | Building Business Case |
| 5 | `proposal_sent` | Proposal Sent |
| 6 | `internal_review` | Internal Review |
| 7 | `verbal_commit` | Verbal Commit |
| 8 | `contract_sent` | Contract Sent |
| 9 | `contract_under_negotiation` | Contract Under Negotiation |
| 10 | `contract_in_signatures` | Contract in Signatures |
| — | `closed_won` | Closed-Won (won terminal) |
| — | `lost` | Lost (lost terminal) |

### Renewal (slug → Attio title)

| Order | Slug | Attio title |
|--:|---|---|
| 1 | `renewal_opportunity_identified` | Renewal - Opportunity Identified |
| 2 | `renewal_value_meeting_review` | Renewal - Value Meeting Review |
| 3 | `renewal_proposal_next_year` | Renewal - Proposal Plan for Next Year |
| 4 | `renewal_negotiating` | Renewal -  Negotiating *(note double space — normalize)* |
| 5 | `renewal_verbal_commit` | Renewal - Verbal Commit |
| 6 | `renewal_contracting` | Renewal - Contracting |
| out-of-band | `renewal_at_risk` | Renewal - At Risk (pinned 25%, excluded from chain) |
| — | `renewal_renewed` | Renewal - Renewed (won terminal) |
| — | `renewal_churn_lost` | Renewal - Churn/Lost (lost terminal) |

**Deprecated slugs** (retained in the enum so historical rows/snapshots don't break; never
written after re-sync): `opp_qual`, `stakeholder`, `verbal`, `contracting`.

## Seed assumptions

Stakeholder-provided `conversionToNext` (source of truth). Derived `overallCloseRate` shown
for sanity (cumulative product through last chain stage); these reproduce the implied-close
curve from the assumptions deck.

### New Logo

| Stage | Days in stage | conversionToNext | derived close |
|---|--:|--:|--:|
| First Conversation | 31 | 95% | 10.3% |
| Stakeholder Meeting Set | 14 | 90% | 10.8% |
| Stakeholder Meeting Complete | 31 | 75% | 12.0% |
| Building Business Case | 45 | 70% | 16.0% |
| Proposal Sent | 45 | 60% | 22.9% |
| Internal Review | 31 | 50% | 38.1% |
| Verbal Commit | 31 | 90% | 76.2% |
| Contract Sent | 45 | 90% | 84.6% |
| Contract Under Negotiation | 45 | 95% | 94.1% |
| Contract in Signatures | 14 | 99% | 99.0% |

### Renewal

No days-in-stage (untimed). At Risk excluded from chain.

| Stage | conversionToNext | derived close |
|---|--:|--:|
| Renewal - Opportunity Identified | 98% | 90.4% |
| Renewal - Value Meeting Review | 98% | 92.2% |
| Renewal - Proposal Plan for Next Year | 98% | 94.1% |
| Renewal - Negotiating | 98% | 96.0% |
| Renewal - Verbal Commit | 99% | 98.0% |
| Renewal - Contracting | 99% | 99.0% |
| **Renewal - At Risk** | **n/a** | **25% (pinned override)** |

## Components / Changes

### New: `src/lib/stages.ts`
- `Pipeline = "new_logo" | "renewal"`.
- `NEW_LOGO_STAGE_ORDER`, `RENEWAL_CHAIN_ORDER` (excludes At Risk), terminal-stage constants.
- `STAGE_TO_PIPELINE`, `STAGE_LABELS` (display), `pipelineForStage(slug)`.
- `ATTIO_STAGE_MAP` (Attio title → slug) with input normalization that collapses repeated
  whitespace so "Renewal -  Negotiating" maps correctly.

### Schema + migration (`prisma/schema.prisma`)
- Extend `DealStage` enum with all new slugs (keep deprecated ones).
- Add `enum Pipeline { new_logo renewal }`.
- Add `pipeline Pipeline` to `StageAssumption` (each assumption belongs to one pipeline).
  `stage` remains `@id` (slugs are globally unique across pipelines).
- Migration: `ALTER TYPE` to add enum values; create `Pipeline` enum; add column with a
  backfill that sets `pipeline` from the slug. No deal-data backfill (re-sync handles it).

### `src/lib/close-rate.ts`
- Replace single `ACTIVE_STAGE_ORDER` with per-pipeline orderings sourced from `stages.ts`.
- `deriveCloseRates(rows, order)` parameterized by chain order. At Risk is not in any chain;
  its effective rate comes solely from `closeRateOverride`.
- `effectiveCloseRate` unchanged.

### `src/lib/calculations.ts`
- `STAGE_ORDER` sourced from `stages.ts`. `weightedForecast` filters/segments by pipeline.
- Implementation buffer `+60 → +45`. Confirm `inYearRevenue` callers (else leave dormant).

### `src/lib/attio.ts`
- `STAGE_MAP` → `ATTIO_STAGE_MAP` from `stages.ts`, with whitespace normalization.
- `firstConvoDate` derivation still keys on "First Conversation" — unchanged.

### `src/lib/sync-utils.ts`
- `computeDealStatus`: `renewal_renewed` → won; `renewal_churn_lost` → lost.
- `closedWonDate` set on `closed_won` **or** `renewal_renewed`; `closedLostDate` on `lost`
  **or** `renewal_churn_lost`.

### Settings (`StageAssumptionsSection.tsx` + `api/settings/assumptions/route.ts`)
- Render two grouped tables (New Logo / Renewal), each with derived close-rate column + override.
- At Risk row: direct close-rate input (override), no derived value.
- PATCH recomputes effective close rate **per pipeline chain** and persists `overallCloseRate`.

### Views
- **New Logo Deals** (renamed `pipeline` route): existing components, filtered to new-logo stages.
  `pipeline-data.ts` `STAGE_SORT` sourced from `stages.ts`; data filtered by pipeline.
- **Renewal Deals** (new route + nav item): renewal-stage deals; untimed weighted forecast;
  KPI strip surfaces pipeline value, weighted forecast, count, **At-Risk ARR**, churn/lost.
- **Dashboard**: add combined + broken-out widgets (New Logo / Renewal / Combined pipeline +
  weighted forecast). Goal/coverage math unchanged. New-logo weighted forecast uses 45-day lag.
- **Leads**: unchanged (New-Logo blueprint/coverage). Stage references sourced from `stages.ts`.

### Seed (`prisma/seed.ts`)
- Replace `STAGE_DEFAULTS` with the two tables above (conversionToNext + days + At Risk override),
  tagged by `pipeline`.

## Migration & rollout
1. Apply Prisma migration (enum + `Pipeline` + `StageAssumption.pipeline`).
2. Run seed to populate new assumptions.
3. Re-sync from Attio — live deals adopt new stages (no manual backfill).
4. Deploy. Old-stage closed deals retain deprecated slugs; that's fine (history left as-is).

## Verification
- Unit-verify `deriveCloseRates` for both chains with a throwaway `tsx` assertion (matches the
  derived-close columns above; At Risk = override).
- `npm run lint` and `npm run build` (incl. `prisma generate` + typecheck) pass.
- `grep` for stray old-stage literals (`opp_qual`, `"stakeholder"`, `STAGE_ORDER` arrays) —
  all should route through `stages.ts`.
- Manual: New Logo Deals shows 10-stage funnel; Renewal Deals shows renewal funnel with
  At-Risk broken out; Dashboard combined/broken-out widgets reconcile; Settings edits to a
  conversion rate re-derive that pipeline's close rates and flow to the views.

## Out of scope
- Feeding the renewal pipeline into the revenue-goal math (option (ii) — deferred).
- Rewriting historical Analyzer snapshots into new stages.
- Renewal days-in-stage / timed renewal forecast.
- Test-framework introduction.
