// src/app/(dashboard)/settings/page.tsx
import { TopBar } from "@/components/layout/TopBar";
import { UserManagementSection } from "@/components/settings/UserManagementSection";
import { FiscalConfigSection } from "@/components/settings/FiscalConfigSection";
import { StageAssumptionsSection } from "@/components/settings/StageAssumptionsSection";
import { RolePermissionsCard } from "@/components/settings/RolePermissionsCard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

async function getSettingsData(years: number[]) {
  const [users, invites, fiscalConfigs, assumptions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.fiscalConfig.findMany({
      where: { fiscalYear: { in: years } },
    }),
    prisma.stageAssumption.findMany({ orderBy: { stage: "asc" } }),
  ]);

  return { users, invites, fiscalConfigs, assumptions };
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session || session.user.role !== "FINANCE") redirect("/");

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const { users, invites, fiscalConfigs, assumptions } = await getSettingsData(years);

  // Build a config entry for every year in the range, defaulting to 0 if not yet set
  const configsByYear = new Map(fiscalConfigs.map((c) => [c.fiscalYear, c]));
  const serializedConfigs = years.map((y) => ({
    fiscalYear: y,
    revenueGoal: Number(configsByYear.get(y)?.revenueGoal ?? 0),
  }));

  const serializedAssumptions = assumptions.map((a) => ({
    stage: a.stage as string,
    pipeline: a.pipeline as "new_logo" | "renewal",
    overallCloseRate: a.overallCloseRate,
    closeRateOverride: a.closeRateOverride,
    conversionToNext: a.conversionToNext,
    avgDaysInStage: a.avgDaysInStage,
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  const serializedInvites = invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    invitedBy: inv.invitedBy,
    createdAt: inv.createdAt.toISOString(),
    usedAt: inv.usedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-6 space-y-8">
        <UserManagementSection
          currentUserId={session.user.id}
          initialUsers={serializedUsers}
          initialInvites={serializedInvites}
        >
          <RolePermissionsCard />
        </UserManagementSection>
        <FiscalConfigSection initialConfigs={serializedConfigs} />
        <StageAssumptionsSection initialRows={serializedAssumptions} />
      </div>
    </div>
  );
}
