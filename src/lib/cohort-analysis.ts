// src/lib/cohort-analysis.ts
import { prisma } from "@/lib/prisma";
import { NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER } from "@/lib/stages";

// Monotonic funnel rank used to classify advanced/held/regressed across two snapshots.
// Covers new + renewal slugs AND deprecated OLD slugs (historical rows / cross-boundary
// comparisons). Terminals (won/lost) are also special-cased before this map is consulted.
const STAGE_ORDER: Record<string, number> = {
  // New-logo funnel (0..9)
  ...Object.fromEntries(NEW_LOGO_STAGE_ORDER.map((s, i) => [s, i])),
  // Renewal funnel on its own band (10..15); renewal_at_risk sits low within renewals
  ...Object.fromEntries(RENEWAL_CHAIN_ORDER.map((s, i) => [s, 10 + i])),
  renewal_at_risk: 10,
  // Deprecated OLD slugs mapped to approximate new-funnel positions (old->new migration):
  opp_qual: 2,      // ~ stakeholder_meeting_set/complete/building_business_case
  stakeholder: 5,   // ~ proposal_sent/internal_review (old "Stakeholder Buy-In")
  verbal: 6,        // ~ verbal_commit
  contracting: 8,   // ~ contract_sent/under_negotiation/in_signatures
  // Terminals
  closed_won: 100,
  renewal_renewed: 100,
  lost: -1,
  renewal_churn_lost: -1,
};

export type BucketDeal = {
  dealId: string;
  name: string;
  companyName: string | null;
  value: number;
  stageA: string | null;   // null when deal didn't exist at snapshot A (New Pipeline)
  stageB: string | null;   // null when deal didn't exist at snapshot B (Not Found)
  status: string | null;   // snapshot B status (or A's when deal not in B)
  source: string | null;
  typeOfDeal: string | null;
  daysInStage: number | null;
  firstConvoDate: string | null;
  expectedClosedDate: string | null;
};

export type CohortRow = {
  category: "closed_won" | "closed_lost" | "advanced" | "held" | "regressed" | "not_found";
  dealCount: number;
  totalValue: number;
  deals: BucketDeal[];
};

export type FlowMetrics = {
  newDeals: number;
  newValue: number;
  newDealsList: BucketDeal[];
  wonDeals: number;
  wonValue: number;
  wonDealsList: BucketDeal[];
  lostDeals: number;
  lostValue: number;
  lostDealsList: BucketDeal[];
  netPipelineChange: number;
};

export type CohortAnalysisResult = {
  snapshotAtA: string;
  snapshotAtB: string;
  cohortRows: CohortRow[];
  flowMetrics: FlowMetrics;
  cohortTotal: number;
  cohortTotalValue: number;
};

function isActivePipeline(status: string | null): boolean {
  return status === "active" || status === "stalled";
}

export async function getCohortAnalysis(
  manifestIdA: string,
  manifestIdB: string
): Promise<CohortAnalysisResult> {
  const [manifestA, manifestB] = await Promise.all([
    prisma.snapshotManifest.findUniqueOrThrow({
      where: { id: manifestIdA },
      include: { deals: true },
    }),
    prisma.snapshotManifest.findUniqueOrThrow({
      where: { id: manifestIdB },
      include: { deals: true },
    }),
  ]);

  if (manifestA.snapshotAt >= manifestB.snapshotAt) {
    throw new Error("manifestIdA must be the earlier snapshot (snapshotAt A < snapshotAt B)");
  }

  const cohortDeals = manifestA.deals.filter((d) => isActivePipeline(d.status));
  const bByDealId = new Map(manifestB.deals.map((d) => [d.dealId, d]));
  const aByDealId = new Map(manifestA.deals.map((d) => [d.dealId, d]));

  // Collect all deal IDs we need live data for (cohort + any B-only deals for flow metrics).
  const bPipelineDeals = manifestB.deals.filter((d) => isActivePipeline(d.status));
  const aPipelineIds = new Set(cohortDeals.map((d) => d.dealId));
  const allDealIds = new Set<string>();
  for (const d of cohortDeals) allDealIds.add(d.dealId);
  for (const d of bPipelineDeals) allDealIds.add(d.dealId);
  for (const d of manifestB.deals) {
    if ((d.stage === "closed_won" || d.stage === "lost") && aPipelineIds.has(d.dealId)) {
      allDealIds.add(d.dealId);
    }
  }

  const liveDeals = await prisma.deal.findMany({
    where: { id: { in: Array.from(allDealIds) } },
    include: { company: true },
  });
  const liveByDealId = new Map(liveDeals.map((d) => [d.id, d]));

  const today = new Date();

  function makeBucketDeal(
    dealId: string,
    snapshotA: typeof manifestA.deals[number] | undefined,
    snapshotB: typeof manifestB.deals[number] | undefined,
  ): BucketDeal {
    const live = liveByDealId.get(dealId);
    // Prefer B's name/value (most recent snapshot context), fall back to A.
    const src = snapshotB ?? snapshotA;
    return {
      dealId,
      name: src?.name ?? live?.name ?? dealId,
      companyName: live?.company?.name ?? null,
      value: Number((src?.value ?? 0)),
      stageA: snapshotA?.stage ?? null,
      stageB: snapshotB?.stage ?? null,
      status: (snapshotB?.status ?? snapshotA?.status) ?? null,
      source: (live?.source as string | null) ?? null,
      typeOfDeal: (live?.typeOfDeal as string | null) ?? null,
      daysInStage: live?.stageEnteredAt
        ? Math.floor((today.getTime() - new Date(live.stageEnteredAt).getTime()) / 86400000)
        : null,
      firstConvoDate: live?.firstConvoDate?.toISOString() ?? null,
      expectedClosedDate: live?.expectedClosedDate?.toISOString() ?? null,
    };
  }

  const counts: Record<CohortRow["category"], { count: number; value: number; deals: BucketDeal[] }> = {
    closed_won:  { count: 0, value: 0, deals: [] },
    closed_lost: { count: 0, value: 0, deals: [] },
    advanced:    { count: 0, value: 0, deals: [] },
    held:        { count: 0, value: 0, deals: [] },
    regressed:   { count: 0, value: 0, deals: [] },
    not_found:   { count: 0, value: 0, deals: [] },
  };

  for (const dealA of cohortDeals) {
    const v = Number(dealA.value ?? 0);
    const dealB = bByDealId.get(dealA.dealId);
    const bd = makeBucketDeal(dealA.dealId, dealA, dealB);

    if (!dealB) {
      counts.not_found.count += 1;
      counts.not_found.value += v;
      counts.not_found.deals.push(bd);
      continue;
    }
    if (dealB.stage === "closed_won") {
      counts.closed_won.count += 1;
      counts.closed_won.value += v;
      counts.closed_won.deals.push(bd);
    } else if (dealB.stage === "lost") {
      counts.closed_lost.count += 1;
      counts.closed_lost.value += v;
      counts.closed_lost.deals.push(bd);
    } else {
      const aIdx = STAGE_ORDER[dealA.stage ?? ""] ?? -1;
      const bIdx = STAGE_ORDER[dealB.stage ?? ""] ?? -1;
      if (bIdx > aIdx) {
        counts.advanced.count += 1;
        counts.advanced.value += v;
        counts.advanced.deals.push(bd);
      } else if (bIdx === aIdx) {
        counts.held.count += 1;
        counts.held.value += v;
        counts.held.deals.push(bd);
      } else {
        counts.regressed.count += 1;
        counts.regressed.value += v;
        counts.regressed.deals.push(bd);
      }
    }
  }

  const cohortRows: CohortRow[] = (
    Object.entries(counts) as [CohortRow["category"], { count: number; value: number; deals: BucketDeal[] }][]
  ).map(([category, { count, value, deals }]) => ({
    category, dealCount: count, totalValue: value, deals,
  }));

  // Flow metrics
  const newDealsRaw = bPipelineDeals.filter((d) => !aPipelineIds.has(d.dealId));
  const wonDealsRaw = manifestB.deals.filter((d) => d.stage === "closed_won" && aPipelineIds.has(d.dealId));
  const lostDealsRaw = manifestB.deals.filter((d) => d.stage === "lost" && aPipelineIds.has(d.dealId));

  const aTotal = cohortDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const bTotal = bPipelineDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);

  const flowMetrics: FlowMetrics = {
    newDeals: newDealsRaw.length,
    newValue: newDealsRaw.reduce((s, d) => s + Number(d.value ?? 0), 0),
    newDealsList: newDealsRaw.map((d) => makeBucketDeal(d.dealId, aByDealId.get(d.dealId), d)),
    wonDeals: wonDealsRaw.length,
    wonValue: wonDealsRaw.reduce((s, d) => s + Number(d.value ?? 0), 0),
    wonDealsList: wonDealsRaw.map((d) => makeBucketDeal(d.dealId, aByDealId.get(d.dealId), d)),
    lostDeals: lostDealsRaw.length,
    lostValue: lostDealsRaw.reduce((s, d) => s + Number(d.value ?? 0), 0),
    lostDealsList: lostDealsRaw.map((d) => makeBucketDeal(d.dealId, aByDealId.get(d.dealId), d)),
    netPipelineChange: bTotal - aTotal,
  };

  return {
    snapshotAtA: manifestA.snapshotAt.toISOString(),
    snapshotAtB: manifestB.snapshotAt.toISOString(),
    cohortRows,
    flowMetrics,
    cohortTotal: cohortDeals.length,
    cohortTotalValue: aTotal,
  };
}
