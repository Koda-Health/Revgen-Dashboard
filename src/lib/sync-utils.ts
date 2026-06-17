import type { AttioDeal } from "@/lib/attio";
import type { DealStage, DealSource, DealType, ProductLine, PaymentStructure, DealStatus } from "@prisma/client";
import { WON_STAGES, LOST_STAGES } from "@/lib/stages";

const STALL_DAYS = 60;

/**
 * Compute deal status from stage + stageEnteredAt.
 * Stalled = active deal with no stage movement in 60+ days.
 */
export function computeDealStatus(
  stage: string | null,
  stageEnteredAt: Date | null
): "active" | "won" | "lost" | "stalled" {
  if (stage && WON_STAGES.has(stage)) return "won";
  if (stage && LOST_STAGES.has(stage)) return "lost";
  if (stageEnteredAt) {
    const daysSince =
      (Date.now() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= STALL_DAYS) return "stalled";
  }
  return "active";
}

/**
 * Build the Prisma upsert payload for a deal.
 * stageEnteredAt is set to now when the stage changes; preserved otherwise.
 */
export function buildDealUpsert(
  deal: AttioDeal,
  existingStage: string | null,
  existingStageEnteredAt: Date | null
) {
  const now = new Date();
  const stageEnteredAt =
    deal.stage !== existingStage ? now : (existingStageEnteredAt ?? now);
  const status = computeDealStatus(deal.stage, stageEnteredAt);

  return {
    where: { id: deal.id },
    update: {
      name: deal.name,
      companyId: deal.companyId,
      value: deal.value,
      stage: deal.stage as DealStage | null,
      source: deal.source as DealSource | null,
      typeOfDeal: deal.typeOfDeal as DealType | null,
      productLine: deal.productLine as ProductLine | null,
      paymentStructure: deal.paymentStructure as PaymentStructure | null,
      status: status as DealStatus,
      stageEnteredAt,
      firstConvoDate: deal.firstConvoDate,
      expectedClosedDate: deal.expectedClosedDate,
      closedWonDate: deal.stage && WON_STAGES.has(deal.stage) ? deal.closeDate : null,
      closedLostDate: deal.stage && LOST_STAGES.has(deal.stage) ? deal.closeDate : null,
      implementationFeeValue: deal.implementationFeeValue,
      integrationFeeValue: deal.integrationFeeValue,
      attioUpdatedAt: deal.attioUpdatedAt,
      lastSyncedAt: now,
    },
    create: {
      id: deal.id,
      name: deal.name,
      companyId: deal.companyId,
      value: deal.value,
      stage: deal.stage as DealStage | null,
      source: deal.source as DealSource | null,
      typeOfDeal: deal.typeOfDeal as DealType | null,
      productLine: deal.productLine as ProductLine | null,
      paymentStructure: deal.paymentStructure as PaymentStructure | null,
      status: status as DealStatus,
      stageEnteredAt,
      firstConvoDate: deal.firstConvoDate,
      expectedClosedDate: deal.expectedClosedDate,
      closedWonDate: deal.stage && WON_STAGES.has(deal.stage) ? deal.closeDate : null,
      closedLostDate: deal.stage && LOST_STAGES.has(deal.stage) ? deal.closeDate : null,
      implementationFeeValue: deal.implementationFeeValue,
      integrationFeeValue: deal.integrationFeeValue,
      attioCreatedAt: deal.attioCreatedAt,
      attioUpdatedAt: deal.attioUpdatedAt,
      lastSyncedAt: now,
    },
  };
}
