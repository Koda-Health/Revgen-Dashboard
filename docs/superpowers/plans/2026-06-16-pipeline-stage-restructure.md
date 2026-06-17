# New-Logo & Renewal Pipeline Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Attio's restructured deal stages, split the dashboard into separate New-Logo and Renewal pipeline views, and seed the new close-rate/days-in-stage assumptions.

**Architecture:** A single `src/lib/stages.ts` module becomes the source of truth for stage slugs, per-pipeline funnel ordering, Attio-title mapping, and labels. The existing conversion→close-rate engine is reused (Option B); the renewal "At Risk" stage is pinned out-of-band. Renewal forecast is display-only and untimed. Two pipeline views replace the single blended Pipeline view; the Dashboard gains combined + broken-out widgets without changing the goal math.

**Tech Stack:** Next.js (App Router), Prisma + PostgreSQL (Neon), TypeScript, Tailwind. **No test framework exists in this repo** (per the settings-driven-assumptions spec) — pure logic is verified with throwaway `tsx` assertion scripts; everything else via `npm run lint`, `npm run build` (runs `prisma generate` + typecheck), and manual checks.

**Spec:** `docs/superpowers/specs/2026-06-16-pipeline-stage-restructure-design.md`

**Branch:** Create `feat/pipeline-stage-restructure` off the current branch before starting.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/stages.ts` | Single source of truth: slugs, orderings, pipeline membership, labels, Attio mapping, impl-lag constant | Create |
| `prisma/schema.prisma` | `DealStage` enum expansion, `Pipeline` enum, `StageAssumption.pipeline` | Modify |
| `prisma/migrations/<ts>_pipeline_restructure/migration.sql` | Enum + column DDL | Create |
| `prisma/seed.ts` | Two-pipeline assumption defaults | Modify |
| `src/lib/close-rate.ts` | Parameterized cumulative-product derivation | Modify |
| `src/lib/calculations.ts` | Stage order from `stages.ts`; 45-day lag | Modify |
| `src/lib/attio.ts` | Attio title → slug via `stages.ts` (whitespace-normalized) | Modify |
| `src/lib/sync-utils.ts` | Renewal terminal status + close-date mapping | Modify |
| `src/app/api/settings/assumptions/route.ts` | Per-pipeline close-rate recompute + validation | Modify |
| `src/components/settings/StageAssumptionsSection.tsx` | Two grouped tables; At Risk direct input | Modify |
| `src/lib/pipeline-data.ts` | `getPipelineData(pipeline)` filter + stage sort from `stages.ts` | Modify |
| `src/components/layout/Sidebar.tsx` | Nav: "New Logo Deals" + "Renewal Deals" | Modify |
| `src/app/(dashboard)/pipeline/page.tsx` | New-Logo view (filtered) | Modify |
| `src/app/(dashboard)/renewals/page.tsx` | Renewal view | Create |
| `src/components/pipeline/PipelineKpiStrip.tsx` | Accept renewal KPI variant (At-Risk ARR / churn) | Modify |
| `src/lib/dashboard-data.ts` | 45-day lag; new-logo-only goal forecast; combined/broken-out widget data | Modify |
| `src/components/dashboard/PipelineSplitWidgets.tsx` | Combined + broken-out widget row | Create |
| `src/app/(dashboard)/page.tsx` | Mount split widgets | Modify |
| `src/lib/leads-data.ts` | New-logo chain from `stages.ts`; 45-day buffer | Modify |

---

## Phase 1 — Foundation

### Task 1: Create `src/lib/stages.ts` (single source of truth)

**Files:**
- Create: `src/lib/stages.ts`
- Test: `scripts/verify-stages.ts` (throwaway assertion script)

- [ ] **Step 1: Create the module**

```ts
// src/lib/stages.ts
// Single source of truth for pipeline stages. Every consumer (sync, forecast,
// settings, views) must read stage slugs / ordering / labels from here.

export type Pipeline = "new_logo" | "renewal";

// New-logo funnel order (active, forecastable stages only).
export const NEW_LOGO_STAGE_ORDER = [
  "first_convo",
  "stakeholder_meeting_set",
  "stakeholder_meeting_complete",
  "building_business_case",
  "proposal_sent",
  "internal_review",
  "verbal_commit",
  "contract_sent",
  "contract_under_negotiation",
  "contract_in_signatures",
] as const;

// Renewal cumulative-product chain (EXCLUDES at-risk, which is out-of-band).
export const RENEWAL_CHAIN_ORDER = [
  "renewal_opportunity_identified",
  "renewal_value_meeting_review",
  "renewal_proposal_next_year",
  "renewal_negotiating",
  "renewal_verbal_commit",
  "renewal_contracting",
] as const;

// Out-of-band renewal stage: pinned close rate, never in the chain.
export const RENEWAL_AT_RISK = "renewal_at_risk";

// Terminal stages.
export const NEW_LOGO_WON = "closed_won";
export const NEW_LOGO_LOST = "lost";
export const RENEWAL_WON = "renewal_renewed";
export const RENEWAL_LOST = "renewal_churn_lost";

export const WON_STAGES = new Set<string>([NEW_LOGO_WON, RENEWAL_WON]);
export const LOST_STAGES = new Set<string>([NEW_LOGO_LOST, RENEWAL_LOST]);

// All active (forecastable) stages per pipeline.
export const NEW_LOGO_ACTIVE: readonly string[] = NEW_LOGO_STAGE_ORDER;
export const RENEWAL_ACTIVE: readonly string[] = [...RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK];

// Pipeline membership for every stage slug (active + terminal).
export const STAGE_TO_PIPELINE: Record<string, Pipeline> = {
  ...Object.fromEntries(NEW_LOGO_STAGE_ORDER.map((s) => [s, "new_logo" as Pipeline])),
  closed_won: "new_logo",
  lost: "new_logo",
  ...Object.fromEntries(RENEWAL_CHAIN_ORDER.map((s) => [s, "renewal" as Pipeline])),
  renewal_at_risk: "renewal",
  renewal_renewed: "renewal",
  renewal_churn_lost: "renewal",
};

export function pipelineForStage(stage: string | null | undefined): Pipeline | null {
  if (!stage) return null;
  return STAGE_TO_PIPELINE[stage] ?? null;
}

export function chainForPipeline(p: Pipeline): readonly string[] {
  return p === "new_logo" ? NEW_LOGO_STAGE_ORDER : RENEWAL_CHAIN_ORDER;
}

// Display labels (used by Settings + views).
export const STAGE_LABELS: Record<string, string> = {
  first_convo: "First Conversation",
  stakeholder_meeting_set: "Stakeholder Meeting Set",
  stakeholder_meeting_complete: "Stakeholder Meeting Complete",
  building_business_case: "Building Business Case",
  proposal_sent: "Proposal Sent",
  internal_review: "Internal Review",
  verbal_commit: "Verbal Commit",
  contract_sent: "Contract Sent",
  contract_under_negotiation: "Contract Under Negotiation",
  contract_in_signatures: "Contract in Signatures",
  closed_won: "Closed-Won",
  lost: "Lost",
  renewal_opportunity_identified: "Opportunity Identified",
  renewal_value_meeting_review: "Value Meeting Review",
  renewal_proposal_next_year: "Proposal Plan for Next Year",
  renewal_at_risk: "At Risk",
  renewal_negotiating: "Negotiating",
  renewal_verbal_commit: "Verbal Commit",
  renewal_contracting: "Contracting",
  renewal_renewed: "Renewed",
  renewal_churn_lost: "Churn/Lost",
};

// Attio status title → internal slug. Keys are whitespace-normalized so the
// double space in Attio's "Renewal -  Negotiating" still resolves.
export function normalizeAttioTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

const ATTIO_STAGE_ENTRIES: [string, string][] = [
  ["First Conversation", "first_convo"],
  ["Stakeholder Meeting Set", "stakeholder_meeting_set"],
  ["Stakeholder Meeting Complete", "stakeholder_meeting_complete"],
  ["Building Business Case", "building_business_case"],
  ["Proposal Sent", "proposal_sent"],
  ["Internal Review", "internal_review"],
  ["Verbal Commit", "verbal_commit"],
  ["Contract Sent", "contract_sent"],
  ["Contract Under Negotiation", "contract_under_negotiation"],
  ["Contract in Signatures", "contract_in_signatures"],
  ["Closed-Won", "closed_won"],
  ["Lost", "lost"],
  ["Renewal - Opportunity Identified", "renewal_opportunity_identified"],
  ["Renewal - Value Meeting Review", "renewal_value_meeting_review"],
  ["Renewal - Proposal Plan for Next Year", "renewal_proposal_next_year"],
  ["Renewal - At Risk", "renewal_at_risk"],
  ["Renewal - Negotiating", "renewal_negotiating"],
  ["Renewal - Verbal Commit", "renewal_verbal_commit"],
  ["Renewal - Contracting", "renewal_contracting"],
  ["Renewal - Renewed", "renewal_renewed"],
  ["Renewal - Churn/Lost", "renewal_churn_lost"],
];

const ATTIO_STAGE_MAP = new Map(
  ATTIO_STAGE_ENTRIES.map(([title, slug]) => [normalizeAttioTitle(title), slug]),
);

export function attioStageToSlug(title: string | null): string | null {
  if (!title) return null;
  return ATTIO_STAGE_MAP.get(normalizeAttioTitle(title)) ?? null;
}

// Days before new-logo revenue starts after Closed-Won (implementation ramp).
export const IMPLEMENTATION_LAG_DAYS = 45;
```

- [ ] **Step 2: Write the verification script**

```ts
// scripts/verify-stages.ts
import assert from "node:assert";
import {
  attioStageToSlug, pipelineForStage, RENEWAL_ACTIVE, NEW_LOGO_STAGE_ORDER,
} from "../src/lib/stages";

// Double space in Attio's "Negotiating" still resolves.
assert.equal(attioStageToSlug("Renewal -  Negotiating"), "renewal_negotiating");
assert.equal(attioStageToSlug("First Conversation"), "first_convo");
assert.equal(attioStageToSlug("Renewal - Renewed"), "renewal_renewed");
assert.equal(attioStageToSlug("Bogus"), null);

// Membership routing.
assert.equal(pipelineForStage("contract_sent"), "new_logo");
assert.equal(pipelineForStage("renewal_at_risk"), "renewal");
assert.equal(pipelineForStage(null), null);

// At-risk is active for renewal but not in the chain.
assert.ok(RENEWAL_ACTIVE.includes("renewal_at_risk"));
assert.equal(NEW_LOGO_STAGE_ORDER.length, 10);

console.log("stages.ts OK");
```

- [ ] **Step 3: Run it**

Run: `npx tsx scripts/verify-stages.ts`
Expected: prints `stages.ts OK`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stages.ts scripts/verify-stages.ts
git commit -m "feat(stages): add single source of truth for pipeline stages"
```

---

### Task 2: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (`DealStage` enum ~81-89, `StageAssumption` ~285-294)
- Create: `prisma/migrations/<timestamp>_pipeline_restructure/migration.sql`

- [ ] **Step 1: Expand `DealStage` enum and add `Pipeline`**

In `prisma/schema.prisma`, replace the `DealStage` enum with (old slugs retained as deprecated so historical rows/snapshots don't break):

```prisma
enum DealStage {
  // New-logo pipeline
  first_convo
  stakeholder_meeting_set
  stakeholder_meeting_complete
  building_business_case
  proposal_sent
  internal_review
  verbal_commit
  contract_sent
  contract_under_negotiation
  contract_in_signatures
  closed_won
  lost
  // Renewal pipeline
  renewal_opportunity_identified
  renewal_value_meeting_review
  renewal_proposal_next_year
  renewal_at_risk
  renewal_negotiating
  renewal_verbal_commit
  renewal_contracting
  renewal_renewed
  renewal_churn_lost
  // Deprecated (retained for historical rows; never written after re-sync)
  opp_qual
  stakeholder
  verbal
  contracting
}

enum Pipeline {
  new_logo
  renewal
}
```

- [ ] **Step 2: Add `pipeline` to `StageAssumption`**

```prisma
model StageAssumption {
  stage             DealStage @id
  pipeline          Pipeline  @default(new_logo)
  overallCloseRate  Float
  closeRateOverride Float?
  conversionToNext  Float
  avgDaysInStage    Int
  updatedAt         DateTime  @updatedAt
  updatedById       String?
  updatedBy         User?     @relation(fields: [updatedById], references: [id])
}
```

- [ ] **Step 3: Create the migration SQL**

Create `prisma/migrations/20260616000000_pipeline_restructure/migration.sql`:

```sql
-- New-logo stage additions
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'stakeholder_meeting_set';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'stakeholder_meeting_complete';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'building_business_case';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'internal_review';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'verbal_commit';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_sent';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_under_negotiation';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_in_signatures';
-- Renewal stages
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_opportunity_identified';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_value_meeting_review';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_proposal_next_year';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_at_risk';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_negotiating';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_verbal_commit';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_contracting';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_renewed';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_churn_lost';

-- Pipeline enum
DO $$ BEGIN
  CREATE TYPE "Pipeline" AS ENUM ('new_logo', 'renewal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- StageAssumption.pipeline column
ALTER TABLE "StageAssumption"
  ADD COLUMN IF NOT EXISTS "pipeline" "Pipeline" NOT NULL DEFAULT 'new_logo';
```

> **Note:** Postgres requires `ALTER TYPE ... ADD VALUE` to be committed before the new values are used in the same transaction. Prisma runs each migration statement separately, but if you hit "unsafe use of new value", split the enum additions into their own migration that runs before the seed. Reference: see `prisma/migrations/20260602000000_add_close_rate_override` for this repo's migration style.

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate dev --name pipeline_restructure` (or, against Neon, follow `memory/reference_neon_prisma_migrations.md`).
Expected: migration applies; `prisma generate` regenerates the client with the new enum + `Pipeline` type.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): expand DealStage enum, add Pipeline discriminator"
```

---

### Task 3: Seed two-pipeline assumptions

**Files:**
- Modify: `prisma/seed.ts:5-20`

- [ ] **Step 1: Replace `STAGE_DEFAULTS` and the upsert loop**

```ts
import { PrismaClient, DealStage, Pipeline } from "@prisma/client";

const prisma = new PrismaClient();

// conversionToNext is the source of truth; overallCloseRate is recomputed on
// every Settings save. Seed overallCloseRate to the derived value so a fresh DB
// is correct before any edit. avgDaysInStage = 0 for renewals (untimed).
const STAGE_DEFAULTS: {
  stage: DealStage; pipeline: Pipeline; conversionToNext: number;
  avgDaysInStage: number; overallCloseRate: number; closeRateOverride?: number;
}[] = [
  // ── New Logo ──
  { stage: "first_convo",                  pipeline: "new_logo", conversionToNext: 0.95, avgDaysInStage: 31, overallCloseRate: 0.103 },
  { stage: "stakeholder_meeting_set",      pipeline: "new_logo", conversionToNext: 0.90, avgDaysInStage: 14, overallCloseRate: 0.108 },
  { stage: "stakeholder_meeting_complete", pipeline: "new_logo", conversionToNext: 0.75, avgDaysInStage: 31, overallCloseRate: 0.120 },
  { stage: "building_business_case",       pipeline: "new_logo", conversionToNext: 0.70, avgDaysInStage: 45, overallCloseRate: 0.160 },
  { stage: "proposal_sent",                pipeline: "new_logo", conversionToNext: 0.60, avgDaysInStage: 45, overallCloseRate: 0.229 },
  { stage: "internal_review",              pipeline: "new_logo", conversionToNext: 0.50, avgDaysInStage: 31, overallCloseRate: 0.381 },
  { stage: "verbal_commit",                pipeline: "new_logo", conversionToNext: 0.90, avgDaysInStage: 31, overallCloseRate: 0.762 },
  { stage: "contract_sent",                pipeline: "new_logo", conversionToNext: 0.90, avgDaysInStage: 45, overallCloseRate: 0.846 },
  { stage: "contract_under_negotiation",   pipeline: "new_logo", conversionToNext: 0.95, avgDaysInStage: 45, overallCloseRate: 0.941 },
  { stage: "contract_in_signatures",       pipeline: "new_logo", conversionToNext: 0.99, avgDaysInStage: 14, overallCloseRate: 0.990 },
  // ── Renewal (untimed: avgDaysInStage = 0) ──
  { stage: "renewal_opportunity_identified", pipeline: "renewal", conversionToNext: 0.98, avgDaysInStage: 0, overallCloseRate: 0.904 },
  { stage: "renewal_value_meeting_review",   pipeline: "renewal", conversionToNext: 0.98, avgDaysInStage: 0, overallCloseRate: 0.922 },
  { stage: "renewal_proposal_next_year",     pipeline: "renewal", conversionToNext: 0.98, avgDaysInStage: 0, overallCloseRate: 0.941 },
  { stage: "renewal_negotiating",            pipeline: "renewal", conversionToNext: 0.98, avgDaysInStage: 0, overallCloseRate: 0.960 },
  { stage: "renewal_verbal_commit",          pipeline: "renewal", conversionToNext: 0.99, avgDaysInStage: 0, overallCloseRate: 0.980 },
  { stage: "renewal_contracting",            pipeline: "renewal", conversionToNext: 0.99, avgDaysInStage: 0, overallCloseRate: 0.990 },
  // At Risk: out-of-band, pinned 25%.
  { stage: "renewal_at_risk",                pipeline: "renewal", conversionToNext: 0,    avgDaysInStage: 0, overallCloseRate: 0.25, closeRateOverride: 0.25 },
];

async function main() {
  for (const s of STAGE_DEFAULTS) {
    await prisma.stageAssumption.upsert({
      where: { stage: s.stage },
      update: {
        pipeline: s.pipeline,
        conversionToNext: s.conversionToNext,
        avgDaysInStage: s.avgDaysInStage,
        overallCloseRate: s.overallCloseRate,
        closeRateOverride: s.closeRateOverride ?? null,
      },
      create: {
        stage: s.stage,
        pipeline: s.pipeline,
        conversionToNext: s.conversionToNext,
        avgDaysInStage: s.avgDaysInStage,
        overallCloseRate: s.overallCloseRate,
        closeRateOverride: s.closeRateOverride ?? null,
      },
    });
  }
  // ... keep the existing fiscalConfigs block unchanged ...
```

> Keep the existing `fiscalConfigs` array and its upsert loop (seed.ts:21-69) exactly as-is.

- [ ] **Step 2: Run the seed**

Run: `npx prisma db seed`
Expected: "Seed complete." and 17 `StageAssumption` rows (10 new-logo + 7 renewal).

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(db): seed new-logo and renewal stage assumptions"
```

---

## Phase 2 — Logic layer

### Task 4: Parameterize `close-rate.ts`

**Files:**
- Modify: `src/lib/close-rate.ts`
- Test: `scripts/verify-close-rate.ts`

- [ ] **Step 1: Replace the module body**

```ts
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
```

> **Breaking change:** `deriveCloseRates` now requires a second `order` argument. Tasks 8 and 9 update its callers. The old export `ACTIVE_STAGE_ORDER` is removed — those callers now import `NEW_LOGO_STAGE_ORDER` / `RENEWAL_CHAIN_ORDER`.

- [ ] **Step 2: Write the verification script**

```ts
// scripts/verify-close-rate.ts
import assert from "node:assert";
import { deriveCloseRates } from "../src/lib/close-rate";
import { NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER } from "../src/lib/stages";

const newLogo = [
  ["first_convo", 0.95], ["stakeholder_meeting_set", 0.90],
  ["stakeholder_meeting_complete", 0.75], ["building_business_case", 0.70],
  ["proposal_sent", 0.60], ["internal_review", 0.50], ["verbal_commit", 0.90],
  ["contract_sent", 0.90], ["contract_under_negotiation", 0.95],
  ["contract_in_signatures", 0.99],
].map(([stage, conversionToNext]) => ({ stage: stage as string, conversionToNext: conversionToNext as number }));

const nl = deriveCloseRates(newLogo, NEW_LOGO_STAGE_ORDER);
assert.ok(Math.abs(nl.get("internal_review")! - 0.381) < 0.002, "internal_review ~38.1%");
assert.ok(Math.abs(nl.get("contract_in_signatures")! - 0.99) < 0.001, "contract_in_signatures 99%");
assert.ok(Math.abs(nl.get("first_convo")! - 0.103) < 0.002, "first_convo ~10.3%");

const renewal = [
  ["renewal_opportunity_identified", 0.98], ["renewal_value_meeting_review", 0.98],
  ["renewal_proposal_next_year", 0.98], ["renewal_negotiating", 0.98],
  ["renewal_verbal_commit", 0.99], ["renewal_contracting", 0.99],
].map(([stage, conversionToNext]) => ({ stage: stage as string, conversionToNext: conversionToNext as number }));

const rn = deriveCloseRates(renewal, RENEWAL_CHAIN_ORDER);
assert.ok(Math.abs(rn.get("renewal_opportunity_identified")! - 0.904) < 0.002, "renewal start ~90.4%");
assert.ok(!rn.has("renewal_at_risk"), "at-risk excluded from chain");

console.log("close-rate.ts OK");
```

- [ ] **Step 3: Run it**

Run: `npx tsx scripts/verify-close-rate.ts`
Expected: prints `close-rate.ts OK`. (If the `@/` alias doesn't resolve under tsx, change the imports in both scripts to relative paths.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/close-rate.ts scripts/verify-close-rate.ts
git commit -m "refactor(close-rate): parameterize derivation by pipeline chain"
```

---

### Task 5: Update `calculations.ts`

**Files:**
- Modify: `src/lib/calculations.ts:3-11` (STAGE_ORDER) and `:48` (60→45)

- [ ] **Step 1: Replace `STAGE_ORDER` with the new-logo order from `stages.ts`**

```ts
import type { Deal, StageAssumption, DealStage } from "@prisma/client";
import { NEW_LOGO_STAGE_ORDER, IMPLEMENTATION_LAG_DAYS } from "@/lib/stages";

export const STAGE_ORDER = NEW_LOGO_STAGE_ORDER;
export type ActiveStage = (typeof STAGE_ORDER)[number];
```

- [ ] **Step 2: Update the implementation buffer in `inYearRevenue`**

Change line ~48 from `+ 60; // +60d implementation buffer` to:

```ts
    }, 0) + IMPLEMENTATION_LAG_DAYS; // implementation buffer
```

> `weightedForecast` and `groupDeals` need no logic change — they key off the rate map and run per whatever deals they're given. Pipeline filtering happens at the data layer (Task 10).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: typecheck passes (no remaining references to old `STAGE_ORDER` literals).

- [ ] **Step 4: Commit**

```bash
git add src/lib/calculations.ts
git commit -m "refactor(calculations): stage order from stages.ts, 45-day lag"
```

---

### Task 6: Update `attio.ts` mapping

**Files:**
- Modify: `src/lib/attio.ts:96-106` (STAGE_MAP) and `:207` (stage extraction)

- [ ] **Step 1: Replace the local `STAGE_MAP` + usage with `attioStageToSlug`**

Remove the local `STAGE_MAP` constant (lines 98-106). Add an import at the top:

```ts
import { attioStageToSlug } from "@/lib/stages";
```

In `fetchDeals`, change the `stage` line (was `:207`):

```ts
    stage: attioStageToSlug(getStatus(r, "stage")),
```

> `deriveFirstConvoDate` (line 263) keys on the literal `"First Conversation"` Attio title — leave unchanged; that title still exists.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: passes; no remaining reference to the deleted `STAGE_MAP`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attio.ts
git commit -m "refactor(attio): map deal stage via stages.ts (normalized titles)"
```

---

### Task 7: Update `sync-utils.ts` status mapping

**Files:**
- Modify: `src/lib/sync-utils.ts:10-22` (computeDealStatus) and `:53-54`,`:74-75` (close dates)

- [ ] **Step 1: Map renewal terminals in `computeDealStatus`**

```ts
import { WON_STAGES, LOST_STAGES } from "@/lib/stages";

export function computeDealStatus(
  stage: string | null,
  stageEnteredAt: Date | null
): "active" | "won" | "lost" | "stalled" {
  if (stage && WON_STAGES.has(stage)) return "won";
  if (stage && LOST_STAGES.has(stage)) return "lost";
  if (stageEnteredAt) {
    const daysSince = (Date.now() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= STALL_DAYS) return "stalled";
  }
  return "active";
}
```

- [ ] **Step 2: Update close-date assignment in both `update` and `create` payloads**

Replace the two `closedWonDate` / `closedLostDate` lines (appear at ~53-54 and ~74-75) with:

```ts
      closedWonDate: deal.stage && WON_STAGES.has(deal.stage) ? deal.closeDate : null,
      closedLostDate: deal.stage && LOST_STAGES.has(deal.stage) ? deal.closeDate : null,
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync-utils.ts
git commit -m "feat(sync): map renewal terminal stages to won/lost"
```

---

## Phase 3 — Settings

### Task 8: Pipeline-aware Settings API

**Files:**
- Modify: `src/app/api/settings/assumptions/route.ts`

- [ ] **Step 1: Replace imports + validation + derivation**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DealStage } from "@prisma/client";
import { deriveCloseRates, effectiveCloseRate } from "@/lib/close-rate";
import {
  NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK, STAGE_LABELS,
} from "@/lib/stages";

const VALID_STAGES = new Set<string>(Object.keys(STAGE_LABELS));
// Stages whose close rate is funnel-derived (chain members only — At Risk excluded).
const CHAIN_STAGES = new Set<string>([...NEW_LOGO_STAGE_ORDER, ...RENEWAL_CHAIN_ORDER]);
```

- [ ] **Step 2: Replace the PATCH derivation block**

Replace the validation (lines 43-46) and the single `deriveCloseRates` call (lines 52-62) with per-pipeline derivation:

```ts
  if (updates.some((u) => !VALID_STAGES.has(u.stage as string))) {
    return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
  }

  const existing = await prisma.stageAssumption.findMany({
    select: { stage: true, conversionToNext: true },
  });
  const updateMap = new Map(updates.map((u) => [u.stage as string, u.conversionToNext]));
  const existingMap = new Map(existing.map((e) => [e.stage as string, e.conversionToNext]));
  const convFor = (stage: string) => updateMap.get(stage) ?? existingMap.get(stage) ?? 0;

  // Derive each pipeline's chain independently, then merge.
  const derived = new Map<string, number>([
    ...deriveCloseRates(NEW_LOGO_STAGE_ORDER.map((s) => ({ stage: s, conversionToNext: convFor(s) })), NEW_LOGO_STAGE_ORDER),
    ...deriveCloseRates(RENEWAL_CHAIN_ORDER.map((s) => ({ stage: s, conversionToNext: convFor(s) })), RENEWAL_CHAIN_ORDER),
  ]);
```

- [ ] **Step 3: Update the per-row write so chain stages materialize derived rate and At Risk always uses its override**

Replace the `updates.map(...)` body (lines 65-84) with:

```ts
      updates.map((u) => {
        const stage = u.stage as string;
        const override = u.closeRateOverride ?? null;
        const isChain = CHAIN_STAGES.has(stage);
        const isAtRisk = stage === RENEWAL_AT_RISK;
        // Chain stages: effective = override ?? derived. At Risk: override is the rate.
        const overall = isAtRisk
          ? (override ?? 0)
          : isChain
            ? effectiveCloseRate(derived.get(stage) ?? 0, override)
            : 0;
        return tx.stageAssumption.update({
          where: { stage: u.stage },
          data: {
            conversionToNext: u.conversionToNext,
            avgDaysInStage: u.avgDaysInStage,
            updatedById: session.user.id,
            ...(isChain || isAtRisk
              ? { closeRateOverride: override, overallCloseRate: overall }
              : {}),
          },
        });
      })
```

- [ ] **Step 4: Verify build + manual PATCH**

Run: `npm run build` → passes.
Manual (after `npm run dev`): as a FINANCE user, edit a new-logo conversion rate in Settings and save; confirm 200 and that `overallCloseRate` recomputes for that pipeline only.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/assumptions/route.ts
git commit -m "feat(settings-api): per-pipeline close-rate recompute"
```

---

### Task 9: Two-pipeline Settings UI

**Files:**
- Modify: `src/components/settings/StageAssumptionsSection.tsx`

- [ ] **Step 1: Replace imports, labels, and ordering with `stages.ts`**

```ts
import { useMemo, useState } from "react";
import { deriveCloseRates } from "@/lib/close-rate";
import {
  NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK, STAGE_LABELS,
} from "@/lib/stages";

type AssumptionRow = {
  stage: string;
  pipeline: "new_logo" | "renewal";
  overallCloseRate: number;
  closeRateOverride: number | null;
  conversionToNext: number;
  avgDaysInStage: number;
};
```

Delete the local `STAGE_LABELS`, `STAGE_ORDER`, and `ACTIVE_STAGES` constants (lines 19-30).

- [ ] **Step 2: Compute derived rates per pipeline and split rows into two groups**

Inside the component, replace the single `derived` memo with:

```ts
  const newLogoRows = useMemo(
    () => NEW_LOGO_STAGE_ORDER.map((s) => rows.find((r) => r.stage === s)).filter(Boolean) as AssumptionRow[],
    [rows]
  );
  const renewalChainRows = useMemo(
    () => RENEWAL_CHAIN_ORDER.map((s) => rows.find((r) => r.stage === s)).filter(Boolean) as AssumptionRow[],
    [rows]
  );
  const atRiskRow = rows.find((r) => r.stage === RENEWAL_AT_RISK) ?? null;

  const derivedNewLogo = useMemo(
    () => deriveCloseRates(newLogoRows.map((r) => ({ stage: r.stage, conversionToNext: r.conversionToNext })), NEW_LOGO_STAGE_ORDER),
    [newLogoRows]
  );
  const derivedRenewal = useMemo(
    () => deriveCloseRates(renewalChainRows.map((r) => ({ stage: r.stage, conversionToNext: r.conversionToNext })), RENEWAL_CHAIN_ORDER),
    [renewalChainRows]
  );
```

- [ ] **Step 3: Render two grouped tables**

Extract the existing `<table>` into a reusable inner render that takes `(groupRows, derivedMap, opts)`. Render it twice under headings "New Logo" and "Renewals". For the renewal group, append the At Risk row using the existing override input wired to `handleOverrideChange(RENEWAL_AT_RISK, …)`, but **hide the derived value** and show only the override (At Risk has no derived rate). Use `STAGE_LABELS[row.stage]` for the label. Keep `handleChange`, `handleOverrideChange`, and `handleSave` as-is — `handleSave` already POSTs all `rows`.

> Concretely: factor lines 128-197 (`rows.map(...) => <tr>`) into `function StageRows({ groupRows, derived, showDerived }: {...})` and call `<StageRows groupRows={newLogoRows} derived={derivedNewLogo} showDerived />`, `<StageRows groupRows={renewalChainRows} derived={derivedRenewal} showDerived />`, then a single At Risk `<tr>` with `showDerived={false}` semantics (override input only). The `effectiveRate` for At Risk = `row.closeRateOverride ?? 0`.

- [ ] **Step 4: Pass `pipeline` through the page loader**

In the Settings page that renders this component (find with `grep -rl StageAssumptionsSection src/app`), ensure the rows fetched include `pipeline` (Prisma returns it by default with `findMany()`), and that `initialRows` type carries `pipeline`.

- [ ] **Step 5: Verify build + manual**

Run: `npm run build` → passes.
Manual: Settings shows two tables; New Logo derives 10 rows, Renewals shows 6 chain rows + an At Risk row with only an override input; saving persists and re-renders derived values.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/StageAssumptionsSection.tsx src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings-ui): grouped new-logo + renewal assumption tables"
```

---

## Phase 4 — Pipeline views

### Task 10: Pipeline-aware `pipeline-data.ts`

**Files:**
- Modify: `src/lib/pipeline-data.ts`

- [ ] **Step 1: Import stage helpers and replace `STAGE_SORT`**

```ts
import { prisma } from "@/lib/prisma";
import { weightedForecast } from "@/lib/calculations";
import type { DealRow } from "@/components/ui/DealTable";
import type { BreakdownEntry } from "@/lib/format";
import {
  type Pipeline, NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK,
  pipelineForStage,
} from "@/lib/stages";
export type { BreakdownEntry } from "@/lib/format";

const STAGE_SORT_BY_PIPELINE: Record<Pipeline, string[]> = {
  new_logo: [...NEW_LOGO_STAGE_ORDER],
  renewal: [...RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK],
};
```

- [ ] **Step 2: Add a `pipeline` parameter and filter deals by membership**

Change the signature to `export async function getPipelineData(pipeline: Pipeline = "new_logo"): Promise<PipelineData>`. After loading `deals`, filter:

```ts
  const pipelineDeals = deals.filter((d) => pipelineForStage(d.stage as string | null) === pipeline);
  const activeDeals = pipelineDeals.filter((d) => d.status === "active" || d.status === "stalled");
```

Use `STAGE_SORT_BY_PIPELINE[pipeline]` inside `toStageEntries`'s sort (pass it in or close over it). Win-rate / sales-cycle TTM should also filter to `pipelineDeals` so each view reports its own pipeline.

- [ ] **Step 3: Return whether the forecast is timed**

Add `pipeline` to the returned `PipelineData` so the view can label itself. (The pipeline view's weighted forecast already uses `weightedForecast` = untimed value×rate, which is exactly what Renewals needs.)

- [ ] **Step 4: Verify build**

Run: `npm run build` → passes (note: callers in Task 12 pass the argument).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline-data.ts
git commit -m "feat(pipeline-data): filter by pipeline (new_logo | renewal)"
```

---

### Task 11: Navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:15-22`

- [ ] **Step 1: Rename Pipeline and add Renewals**

```ts
import { LayoutDashboard, GitBranch, RefreshCw, Users, BarChart2, Database, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard",      icon: LayoutDashboard, roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/pipeline",  label: "New Logo Deals", icon: GitBranch,       roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/renewals",  label: "Renewal Deals",  icon: RefreshCw,       roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/leads",     label: "Leads",          icon: Users,           roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/analyzer",  label: "Analyzer",       icon: BarChart2,       roles: ["FINANCE", "LEADERSHIP", "REVGEN"] },
  { href: "/sources",   label: "Data Sources",   icon: Database,        roles: ["FINANCE"] },
  { href: "/settings",  label: "Settings",       icon: Settings,        roles: ["FINANCE"] },
] as const;
```

> The active-state logic (`pathname.startsWith(href)`) already works for `/renewals`.

- [ ] **Step 2: Verify + commit**

Run: `npm run build` → passes.
```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(nav): rename Pipeline to New Logo Deals, add Renewal Deals"
```

---

### Task 12: New-Logo + Renewal pages

**Files:**
- Modify: `src/app/(dashboard)/pipeline/page.tsx`
- Create: `src/app/(dashboard)/renewals/page.tsx`

- [ ] **Step 1: New-Logo page passes the pipeline + new title**

```tsx
// src/app/(dashboard)/pipeline/page.tsx
import { TopBar } from "@/components/layout/TopBar";
import { PipelineClientSection } from "@/components/pipeline/PipelineClientSection";
import { getPipelineData } from "@/lib/pipeline-data";

export default async function NewLogoDealsPage() {
  const data = await getPipelineData("new_logo");
  return (
    <div>
      <TopBar title="New Logo Deals" exportId="export-content" />
      <div id="export-content" className="p-6 space-y-8">
        <PipelineClientSection data={data} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Renewal page**

```tsx
// src/app/(dashboard)/renewals/page.tsx
import { TopBar } from "@/components/layout/TopBar";
import { PipelineClientSection } from "@/components/pipeline/PipelineClientSection";
import { getPipelineData } from "@/lib/pipeline-data";

export default async function RenewalDealsPage() {
  const data = await getPipelineData("renewal");
  return (
    <div>
      <TopBar title="Renewal Deals" exportId="export-content" />
      <div id="export-content" className="p-6 space-y-8">
        <PipelineClientSection data={data} variant="renewal" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Make `PipelineClientSection` aware of stage labels + variant**

In `src/components/pipeline/PipelineClientSection.tsx`, accept an optional `variant?: "new_logo" | "renewal"` prop (default `"new_logo"`) and thread it to `PipelineKpiStrip`. The year-filter and breakdown logic are unchanged. Ensure any stage label lookups use `STAGE_LABELS` from `stages.ts` (replace any inline label maps in `PipelineBarCharts` / `InteractiveBreakdown` / `StagePill` if present — grep `opp_qual` and `stakeholder` under `src/components` and route them through `stages.ts`).

- [ ] **Step 4: Verify build + manual**

Run: `npm run build` → passes.
Manual: `/pipeline` shows only new-logo deals across the 10-stage funnel; `/renewals` shows only renewal-stage deals. Stage labels render via `STAGE_LABELS`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/pipeline/page.tsx" "src/app/(dashboard)/renewals/page.tsx" src/components/pipeline/PipelineClientSection.tsx
git commit -m "feat(views): split into New Logo Deals and Renewal Deals pages"
```

---

### Task 13: Renewal KPI strip (At-Risk ARR + churn)

**Files:**
- Modify: `src/components/pipeline/PipelineKpiStrip.tsx`
- Modify: `src/lib/pipeline-data.ts` (add renewal-specific aggregates)

- [ ] **Step 1: Compute renewal aggregates in `pipeline-data.ts`**

When `pipeline === "renewal"`, also compute and return:

```ts
  // Renewal-only KPIs (0 for new_logo).
  const atRiskArr = activeDeals
    .filter((d) => d.stage === "renewal_at_risk")
    .reduce((s, d) => s + Number(d.value ?? 0), 0);
  const churnedCount = pipelineDeals.filter((d) => d.stage === "renewal_churn_lost").length;
```

Add `atRiskArr: number` and `churnedCount: number` to the `PipelineData` type and return them (default `0` on the new-logo path).

- [ ] **Step 2: Render the variant in `PipelineKpiStrip`**

Accept `variant?: "new_logo" | "renewal"` and `data` carrying `atRiskArr` / `churnedCount`. For `renewal`, swap the two least-relevant new-logo KPI cards for **"At-Risk ARR"** (`formatCurrency(data.atRiskArr)`, coral accent `#EE8363`) and **"Churned (TTM)"** (`data.churnedCount`). Keep Pipeline Value, Weighted Forecast, Active Deals for both. Reuse the existing `KpiCard` component and currency formatter already imported in the file.

- [ ] **Step 3: Verify build + manual**

Run: `npm run build` → passes.
Manual: `/renewals` KPI strip shows At-Risk ARR (coral) and Churned count; `/pipeline` strip unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/pipeline/PipelineKpiStrip.tsx src/lib/pipeline-data.ts
git commit -m "feat(renewals): At-Risk ARR and churn KPIs"
```

---

## Phase 5 — Dashboard widgets

### Task 14: Dashboard data — 45-day lag, new-logo goal forecast, split widgets

**Files:**
- Modify: `src/lib/dashboard-data.ts`

- [ ] **Step 1: Import helpers**

```ts
import { pipelineForStage, IMPLEMENTATION_LAG_DAYS } from "@/lib/stages";
```

- [ ] **Step 2: Restrict the goal-math weighted forecast to new-logo deals and use the 45-day lag**

In the `weightedForecast` reduce (lines 77-99), add a guard at the top of the callback and change the lag constant:

```ts
    if (pipelineForStage(deal.stage as string | null) !== "new_logo") return sum;
    if (!deal.expectedClosedDate || !deal.stage || !deal.value) return sum;
    const closeDate = new Date(deal.expectedClosedDate);
    if (closeDate < fiscalYearStart || closeDate > fiscalYearEnd) return sum;
    const closeRate = rateMap.get(deal.stage as string) ?? 0;
    const revenueStartDate = new Date(closeDate.getTime() + IMPLEMENTATION_LAG_DAYS * 24 * 60 * 60 * 1000);
```

- [ ] **Step 3: Compute combined + broken-out widget aggregates**

After `activeDeals` is computed, add:

```ts
  const splitAgg = (predicate: (stage: string | null) => boolean) => {
    const ds = activeDeals.filter((d) => predicate(d.stage as string | null));
    const pipeline = ds.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const weighted = ds.reduce((s, d) => s + Number(d.value ?? 0) * (rateMap.get(d.stage as string) ?? 0), 0);
    return { pipeline, weighted, count: ds.length };
  };
  const newLogoSplit = splitAgg((s) => pipelineForStage(s) === "new_logo");
  const renewalSplit = splitAgg((s) => pipelineForStage(s) === "renewal");
  const combinedSplit = {
    pipeline: newLogoSplit.pipeline + renewalSplit.pipeline,
    weighted: newLogoSplit.weighted + renewalSplit.weighted,
    count: newLogoSplit.count + renewalSplit.count,
  };
```

Add a `pipelineSplit: { newLogo: …; renewal: …; combined: … }` field to the `DashboardData` type and return `{ newLogo: newLogoSplit, renewal: renewalSplit, combined: combinedSplit }`.

> Renewal weighted here is untimed (value × rate), consistent with the decision. Goal/coverage math (`bookedRevenue`, `revenueGap`, `pctOfGoal`, `pipelineCoverage`) is **unchanged** — still new-logo + flat `expectedFromExisting`.

- [ ] **Step 4: Verify build + commit**

Run: `npm run build` → passes.
```bash
git add src/lib/dashboard-data.ts
git commit -m "feat(dashboard-data): 45-day lag, new-logo goal forecast, split aggregates"
```

---

### Task 15: Dashboard split widgets

**Files:**
- Create: `src/components/dashboard/PipelineSplitWidgets.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create the widget component**

```tsx
// src/components/dashboard/PipelineSplitWidgets.tsx
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard-data";

export function PipelineSplitWidgets({ data }: { data: DashboardData }) {
  const { newLogo, renewal, combined } = data.pipelineSplit;
  const cols: { title: string; s: { pipeline: number; weighted: number; count: number }; accent?: string }[] = [
    { title: "New Logo", s: newLogo },
    { title: "Renewals", s: renewal, accent: "#EE8363" },
    { title: "Combined", s: combined },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map(({ title, s, accent }) => (
        <div key={title} className="bg-white rounded-card shadow-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3"
              style={accent ? { color: accent } : undefined}>{title}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Pipeline</span><span className="font-semibold text-navy">{formatCurrency(s.pipeline)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Weighted</span><span className="font-semibold text-navy">{formatCurrency(s.weighted)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Active deals</span><span className="font-semibold text-navy">{s.count}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

> Verify `formatCurrency` is exported from `src/lib/format.ts`; if the export name differs, use the existing one (grep `export function format` in that file).

- [ ] **Step 2: Mount it on the Dashboard**

In `src/app/(dashboard)/page.tsx`, import and render after `DashboardKpiStrip`:

```tsx
import { PipelineSplitWidgets } from "@/components/dashboard/PipelineSplitWidgets";
// ...
        <DashboardKpiStrip data={data} />
        <PipelineSplitWidgets data={data} />
        <RevenueGoalCard data={data} />
```

- [ ] **Step 3: Verify build + manual**

Run: `npm run build` → passes.
Manual: Dashboard shows New Logo / Renewals / Combined cards; the Revenue Goal card numbers are unchanged from before the split.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/PipelineSplitWidgets.tsx "src/app/(dashboard)/page.tsx"
git commit -m "feat(dashboard): combined + broken-out pipeline widgets"
```

---

## Phase 6 — Leads consistency

### Task 16: Update `leads-data.ts`

**Files:**
- Modify: `src/lib/leads-data.ts:6-14` (ACTIVE_STAGES), `:238` and `:317` (60→45)

- [ ] **Step 1: Source the new-logo chain from `stages.ts`**

```ts
import { NEW_LOGO_STAGE_ORDER, IMPLEMENTATION_LAG_DAYS, pipelineForStage } from "@/lib/stages";

const ACTIVE_STAGES = NEW_LOGO_STAGE_ORDER;
type ActiveStage = (typeof ACTIVE_STAGES)[number];
```

- [ ] **Step 2: Restrict blueprint deals to new-logo and use the 45-day buffer**

The blueprint is a new-logo acquisition model. Where `activeDeals` feeds the blueprint (lines 245-247) and weighted-forecast breakdown (lines 311-332), filter to new-logo deals:

```ts
  const newLogoActive = activeDeals.filter((d) => pipelineForStage(d.stage as string | null) === "new_logo");
```

Use `newLogoActive` in place of `activeDeals` for `actualDealsList` (line 245) and the `weightedForecastBreakdown` loop (line 311). Change the two `+ 60` / `60 * 24 * 60 * 60 * 1000` occurrences (lines 238, 317) to `IMPLEMENTATION_LAG_DAYS`.

- [ ] **Step 3: Verify build + manual**

Run: `npm run build` → passes.
Manual: Leads blueprint renders the 10 new-logo stages with deadlines; renewal deals no longer leak into the blueprint actuals.

- [ ] **Step 4: Commit**

```bash
git add src/lib/leads-data.ts
git commit -m "refactor(leads): new-logo chain from stages.ts, 45-day buffer"
```

---

## Phase 7 — Migration & verification

### Task 17: Rollout + full verification

- [ ] **Step 1: Apply migration + seed against the target DB**

Run (follow `memory/reference_neon_prisma_migrations.md` for Neon specifics):
```
npx prisma migrate deploy
npx prisma db seed
```
Expected: migration applied; 17 `StageAssumption` rows present.

- [ ] **Step 2: Re-sync deals from Attio**

Trigger the Attio sync (the `/api/sync/attio` route / its cron). Expected: live deals adopt the new stage slugs; renewal deals land on `renewal_*` stages.

- [ ] **Step 3: Stale-literal sweep**

Run: `grep -rnE "opp_qual|\"stakeholder\"|\"verbal\"|\"contracting\"" src` (PowerShell: use the Grep tool).
Expected: no remaining *active-logic* references — only the deprecated enum values in `schema.prisma` and historical handling. Route any stragglers through `stages.ts`.

- [ ] **Step 4: Full build + lint**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 5: Manual acceptance checklist**

- New Logo Deals: 10-stage funnel, new-logo deals only.
- Renewal Deals: renewal funnel, At-Risk ARR + churn KPIs, untimed weighted forecast.
- Dashboard: New Logo / Renewals / Combined widgets reconcile to the two views; Revenue Goal numbers unchanged.
- Settings: two grouped tables; editing a conversion rate re-derives that pipeline's close rates and flows to the views; At Risk override persists at 25%.
- Analyzer: loads without error; pre-migration cohorts still render (old slugs intact).

- [ ] **Step 6: Final commit / open PR**

```bash
git add -A
git commit -m "chore: pipeline restructure rollout notes"
```
Open a PR from `feat/pipeline-stage-restructure` when ready (ask the user first).

---

## Self-review notes

- **Spec coverage:** nav rename + new tab (T11–12), prefix routing (T10), Option-B engine retained (T4), At Risk pinned/excluded (T3,T4,T8,T9), renewal display-only/untimed (T13,T14), Dashboard combine-for-display (T14,T15), `stages.ts` SoT (T1, consumed everywhere), enum + Pipeline discriminator (T2), sync terminals (T7), 60→45 lag (T5,T14,T16), history left as-is (T2 deprecated slugs, T17 sweep). All covered.
- **Type consistency:** `deriveCloseRates(rows, order)` signature used identically in T4/T8/T9; `pipelineForStage` / `STAGE_LABELS` / `IMPLEMENTATION_LAG_DAYS` imported from `stages.ts` everywhere; `PipelineData.pipelineSplit` defined in T14 and consumed in T15.
- **Known soft spots to confirm during execution (not placeholders):** exact `formatCurrency` export name in `src/lib/format.ts`; the Settings page file that renders `StageAssumptionsSection`; whether `inYearRevenue` has live callers. Each task lists the grep to resolve these.
