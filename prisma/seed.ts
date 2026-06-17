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

  const fiscalConfigs = [
    {
      fiscalYear: 2025,
      revenueGoal: 1062831,
      existingArr: 800000,
      expectedFromExisting: 800000,
      fiscalYearStart: new Date("2025-01-01"),
      fiscalYearEnd: new Date("2025-12-31"),
    },
    {
      fiscalYear: 2026,
      revenueGoal: 3320386,
      existingArr: 1200000,
      expectedFromExisting: 1200000,
      fiscalYearStart: new Date("2026-01-01"),
      fiscalYearEnd: new Date("2026-12-31"),
    },
    {
      fiscalYear: 2027,
      revenueGoal: 8745025,
      existingArr: 2000000,
      expectedFromExisting: 2000000,
      fiscalYearStart: new Date("2027-01-01"),
      fiscalYearEnd: new Date("2027-12-31"),
    },
    {
      fiscalYear: 2028,
      revenueGoal: 19957727,
      existingArr: 3000000,
      expectedFromExisting: 3000000,
      fiscalYearStart: new Date("2028-01-01"),
      fiscalYearEnd: new Date("2028-12-31"),
    },
  ];

  for (const fc of fiscalConfigs) {
    await prisma.fiscalConfig.upsert({
      where: { fiscalYear: fc.fiscalYear },
      update: {
        revenueGoal: fc.revenueGoal,
        existingArr: fc.existingArr,
        expectedFromExisting: fc.expectedFromExisting,
        fiscalYearStart: fc.fiscalYearStart,
        fiscalYearEnd: fc.fiscalYearEnd,
      },
      create: fc,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
