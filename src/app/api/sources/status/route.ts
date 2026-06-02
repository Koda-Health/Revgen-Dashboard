// src/app/api/sources/status/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SourceStatus, StatusResponse } from "@/types/sources";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [attioLog, snapshotLog, dealCount, companyCount, manifestCount, revenueCount] =
    await Promise.all([
      prisma.auditLog.findFirst({
        where: { action: "SYNC_ATTIO" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findFirst({
        where: { action: "SNAPSHOT_CREATED" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.deal.count(),
      prisma.company.count(),
      prisma.snapshotManifest.count(),
      prisma.actualRevenueEntry.count(),
    ]);

  const toSource = (
    key: string,
    label: string,
    log: { createdAt: Date; details: unknown } | null
  ): SourceStatus => ({
    key,
    label,
    lastSync: log
      ? {
          at: log.createdAt.toISOString(),
          details: (log.details as Record<string, unknown>) ?? {},
        }
      : null,
  });

  const body: StatusResponse = {
    sources: [
      toSource("attio", "Attio CRM", attioLog),
      toSource("snapshot", "Pipeline Snapshot", snapshotLog),
    ],
    dbCounts: {
      deals: dealCount,
      companies: companyCount,
      snapshotManifests: manifestCount,
      revenueEntries: revenueCount,
    },
  };

  return NextResponse.json(body);
}
