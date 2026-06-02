// src/app/(dashboard)/sources/page.tsx
import { TopBar } from "@/components/layout/TopBar";
import { SyncStatusGrid } from "@/components/sources/SyncStatusGrid";
import { SyncHistoryTable } from "@/components/sources/SyncHistoryTable";
import { RevenueUpload } from "@/components/sources/RevenueUpload";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SourceStatus } from "@/types/sources";

async function getInitialStatus() {
  const [attioLog, snapshotLog, dealCount, companyCount, manifestCount, revenueCount] =
    await Promise.all([
      prisma.auditLog.findFirst({ where: { action: "SYNC_ATTIO" }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findFirst({ where: { action: "SNAPSHOT_CREATED" }, orderBy: { createdAt: "desc" } }),
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
      ? { at: log.createdAt.toISOString(), details: (log.details as Record<string, unknown>) ?? {} }
      : null,
  });

  return {
    sources: [
      toSource("attio", "Attio CRM", attioLog),
      toSource("snapshot", "Pipeline Snapshot", snapshotLog),
    ],
    dbCounts: { deals: dealCount, companies: companyCount, snapshotManifests: manifestCount, revenueEntries: revenueCount },
  };
}

export default async function SourcesPage() {
  const session = await auth();
  if (!session) return null;

  const { sources, dbCounts } = await getInitialStatus();

  return (
    <div>
      <TopBar title="Data Sources" />
      <div className="p-6 space-y-8">
        <SyncStatusGrid sources={sources} dbCounts={dbCounts} />
        <RevenueUpload />
        <SyncHistoryTable />
      </div>
    </div>
  );
}
