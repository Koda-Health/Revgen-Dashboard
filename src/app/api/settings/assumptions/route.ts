// src/app/api/settings/assumptions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DealStage } from "@prisma/client";
import { deriveCloseRates, effectiveCloseRate, ACTIVE_STAGE_ORDER } from "@/lib/close-rate";

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

const ACTIVE_STAGES = new Set<string>(ACTIVE_STAGE_ORDER);

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "FINANCE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { updates } = (await req.json()) as { updates: AssumptionUpdate[] };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  const VALID_STAGES = ["first_convo", "opp_qual", "stakeholder", "verbal", "contracting", "closed_won", "lost"];
  if (updates.some((u) => !VALID_STAGES.includes(u.stage as string))) {
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
  const derived = deriveCloseRates(
    ACTIVE_STAGE_ORDER.map((stage) => ({
      stage,
      conversionToNext: updateMap.get(stage) ?? existingMap.get(stage) ?? 0,
    })),
  );

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      updates.map((u) => {
        const isActive = ACTIVE_STAGES.has(u.stage as string);
        const override = u.closeRateOverride ?? null;
        return tx.stageAssumption.update({
          where: { stage: u.stage },
          data: {
            conversionToNext: u.conversionToNext,
            avgDaysInStage: u.avgDaysInStage,
            updatedById: session.user.id,
            // Only active stages participate in the funnel close-rate model.
            ...(isActive
              ? {
                  closeRateOverride: override,
                  overallCloseRate: effectiveCloseRate(derived.get(u.stage as string) ?? 0, override),
                }
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
