// src/app/api/settings/assumptions/route.ts
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

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "FINANCE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const rows = await prisma.stageAssumption.findMany({
    orderBy: { stage: "asc" },
  });

  return NextResponse.json({ rows });
}

type AssumptionUpdate = {
  stage: DealStage;
  conversionToNext: number;
  avgDaysInStage: number;
  // Optional manual pin for the overall close rate. null/omitted = derive from conversion rates.
  closeRateOverride?: number | null;
};

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "FINANCE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { updates } = (await req.json()) as { updates: AssumptionUpdate[] };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  if (updates.some((u) => !VALID_STAGES.has(u.stage as string))) {
    return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
  }

  // Derive each active stage's close rate, then materialize the effective rate
  // (override ?? derived) into overallCloseRate. Derivation needs every active
  // stage's conversion rate, so merge the submitted updates over the stored
  // values in case a caller sends only a subset.
  const existing = await prisma.stageAssumption.findMany({
    select: { stage: true, conversionToNext: true },
  });
  const updateMap = new Map(updates.map((u) => [u.stage as string, u.conversionToNext]));
  const existingMap = new Map(existing.map((e) => [e.stage as string, e.conversionToNext]));
  const convFor = (stage: string) => updateMap.get(stage) ?? existingMap.get(stage) ?? 0;

  // Derive each pipeline's chain independently, then merge.
  const derived = new Map<string, number>([
    ...Array.from(deriveCloseRates(NEW_LOGO_STAGE_ORDER.map((s) => ({ stage: s, conversionToNext: convFor(s) })), NEW_LOGO_STAGE_ORDER)),
    ...Array.from(deriveCloseRates(RENEWAL_CHAIN_ORDER.map((s) => ({ stage: s, conversionToNext: convFor(s) })), RENEWAL_CHAIN_ORDER)),
  ]);

  await prisma.$transaction(async (tx) => {
    await Promise.all(
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
    );
    await tx.auditLog.create({
      data: {
        action: "ASSUMPTION_EDITED",
        userId: session.user.id,
        details: { stagesUpdated: updates.map((u) => u.stage) },
      },
    });
  });

  const rows = await prisma.stageAssumption.findMany({ orderBy: { stage: "asc" } });
  return NextResponse.json({ rows });
}
