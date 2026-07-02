// src/lib/run-sync.ts
import { prisma } from "@/lib/prisma";
import { fetchDeals, fetchCompanies, fetchDealStageHistoriesDetailed } from "@/lib/attio";
import { buildDealUpsert } from "@/lib/sync-utils";
import { pipelineForStage } from "@/lib/stages";
import type { SalesType, CompanyStage, BudgetCycle, Pipeline } from "@prisma/client";

export type AttioSyncResult = {
  companiesUpserted: number;
  dealsUpserted: number;
  deletedDeals: number;
  deletedCompanies: number;
  durationMs: number;
};

export async function runAttioSync(): Promise<AttioSyncResult> {
  const startedAt = Date.now();

  // 1. Sync companies first (deals have FK to companies)
  const companies = await fetchCompanies();
  let companiesUpserted = 0;

  for (const company of companies) {
    await prisma.company.upsert({
      where: { id: company.id },
      update: {
        name: company.name,
        salesType: company.salesType as SalesType | null,
        companyStage: company.companyStage as CompanyStage | null,
        icpTier: company.icpTier,
        icpFitScore: company.icpFitScore,
        patientPopulation: company.patientPopulation,
        budgetCycle: company.budgetCycle as BudgetCycle | null,
        attioUpdatedAt: company.attioUpdatedAt,
        lastSyncedAt: new Date(),
      },
      create: {
        id: company.id,
        name: company.name,
        salesType: company.salesType as SalesType | null,
        companyStage: company.companyStage as CompanyStage | null,
        icpTier: company.icpTier,
        icpFitScore: company.icpFitScore,
        patientPopulation: company.patientPopulation,
        budgetCycle: company.budgetCycle as BudgetCycle | null,
        attioCreatedAt: company.attioCreatedAt,
        attioUpdatedAt: company.attioUpdatedAt,
        lastSyncedAt: new Date(),
      },
    });
    companiesUpserted++;
  }

  // 2. Detect existing stage to compute stageEnteredAt correctly
  const existingDeals = await prisma.deal.findMany({
    select: { id: true, stage: true, stageEnteredAt: true },
  });
  const existingMap = new Map(
    existingDeals.map((d) => [d.id, { stage: d.stage, stageEnteredAt: d.stageEnteredAt }])
  );

  // 3. Sync deals
  const deals = await fetchDeals();

  // 3a. Fetch Attio stage history once per deal: used both to derive firstConvoDate
  // (source of truth) and to persist per-stage transitions for velocity analytics.
  const histories = await fetchDealStageHistoriesDetailed(deals.map((d) => d.id));

  let dealsUpserted = 0;

  for (const deal of deals) {
    const existing = existingMap.get(deal.id);
    // If the history fetch succeeded, use its derived date (which may be null
    // when the deal hasn't reached First Conversation yet). If it failed, leave
    // the existing DB value untouched by passing `undefined`.
    const detail = histories.get(deal.id);
    const dealWithHistory = {
      ...deal,
      firstConvoDate: detail ? detail.firstConvoDate : undefined,
    };
    const upsert = buildDealUpsert(
      dealWithHistory,
      existing?.stage ?? null,
      existing?.stageEnteredAt ?? null
    );
    await prisma.deal.upsert(upsert);
    dealsUpserted++;

    // Persist stage transitions (velocity analytics). Replace-on-resync per deal.
    if (detail) {
      const rows = detail.transitions
        .map((t) => {
          const pipeline = pipelineForStage(t.stage);
          if (!pipeline) return null;
          const durationDays = t.exitedAt
            ? Math.max(0, Math.round((t.exitedAt.getTime() - t.enteredAt.getTime()) / 86_400_000))
            : null;
          return {
            dealId: deal.id,
            stage: t.stage,
            pipeline: pipeline as Pipeline,
            enteredAt: t.enteredAt,
            exitedAt: t.exitedAt,
            durationDays,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      await prisma.stageTransition.deleteMany({ where: { dealId: deal.id } });
      if (rows.length > 0) await prisma.stageTransition.createMany({ data: rows });
    }
  }

  // 4. Compute orphans — IDs present locally but missing from Attio response
  const attioDealIds = new Set(deals.map((d) => d.id));
  const attioCompanyIds = new Set(companies.map((c) => c.id));

  const localDealIds = (await prisma.deal.findMany({ select: { id: true } })).map((d) => d.id);
  const localCompanyIds = (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id);

  const dealsToDelete = localDealIds.filter((id) => !attioDealIds.has(id));

  // Don't delete companies that still have deals (those deals would have already been removed
  // above if they were orphaned themselves — so any remaining deals are valid).
  const companiesStillReferenced = new Set(
    (await prisma.deal.findMany({
      where: { companyId: { not: null }, id: { notIn: dealsToDelete } },
      select: { companyId: true },
    })).map((d) => d.companyId!).filter(Boolean)
  );
  const companiesToDelete = localCompanyIds.filter(
    (id) => !attioCompanyIds.has(id) && !companiesStillReferenced.has(id)
  );

  // 5. Delete in a transaction, preserving revenue history
  let deletedDeals = 0;
  let deletedCompanies = 0;

  if (dealsToDelete.length > 0 || companiesToDelete.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (dealsToDelete.length > 0) {
        await tx.actualRevenueEntry.updateMany({
          where: { dealId: { in: dealsToDelete } },
          data: { dealId: null, matchStatus: "unmatched" },
        });
        const res = await tx.deal.deleteMany({ where: { id: { in: dealsToDelete } } });
        deletedDeals = res.count;
      }
      if (companiesToDelete.length > 0) {
        const res = await tx.company.deleteMany({ where: { id: { in: companiesToDelete } } });
        deletedCompanies = res.count;
      }
      if (deletedDeals > 0 || deletedCompanies > 0) {
        await tx.auditLog.create({
          data: {
            action: "SYNC_ATTIO",
            details: {
              event: "orphan_cleanup",
              deletedDealIds: dealsToDelete,
              deletedCompanyIds: companiesToDelete,
            },
          },
        });
      }
    });
  }

  return { companiesUpserted, dealsUpserted, deletedDeals, deletedCompanies, durationMs: Date.now() - startedAt };
}
