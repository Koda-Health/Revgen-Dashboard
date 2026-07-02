"use client";

import { useState } from "react";
import { PipelineBarChart } from "@/components/pipeline/PipelineBarChart";
import { Modal } from "@/components/ui/Modal";
import { LeadTable } from "@/components/leads/LeadTable";
import { SOURCE_LABELS, TIER_LABELS, COMPANY_STAGE_LABELS } from "@/lib/format";
import type { BreakdownEntry } from "@/lib/format";
import type { LeadCompanyRow } from "@/lib/leads-data";

type Props = {
  bySource: BreakdownEntry[];
  byTier: BreakdownEntry[];
  byStage: BreakdownEntry[];
  companiesBySource: Record<string, LeadCompanyRow[]>;
  companiesByTier: Record<string, LeadCompanyRow[]>;
  companiesByStage: Record<string, LeadCompanyRow[]>;
};

type DrillDown = { title: string; companies: LeadCompanyRow[] } | null;

export function LeadsChartsSection({
  bySource, byTier, byStage,
  companiesBySource, companiesByTier, companiesByStage,
}: Props) {
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  function handleClick(
    map: Record<string, LeadCompanyRow[]>,
    labelMap: Record<string, string>,
    key: string
  ) {
    const companies = map[key] ?? [];
    const title = labelMap[key] ?? key;
    setDrillDown({ title, companies });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6">
        <PipelineBarChart
          title="Leads by Source"
          data={bySource}
          labelMap={SOURCE_LABELS}
          metric="count"
          onBarClick={(k) => handleClick(companiesBySource, SOURCE_LABELS, k)}
        />
        <PipelineBarChart
          title="Leads by ICP Tier"
          data={byTier}
          labelMap={TIER_LABELS}
          metric="count"
          onBarClick={(k) => handleClick(companiesByTier, TIER_LABELS, k)}
        />
      </div>
      <PipelineBarChart
        title="Leads by Stage"
        data={byStage}
        labelMap={COMPANY_STAGE_LABELS}
        metric="count"
        onBarClick={(k) => handleClick(companiesByStage, COMPANY_STAGE_LABELS, k)}
      />

      <Modal
        open={drillDown != null}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title ?? ""}
        width="3xl"
      >
        {drillDown && <LeadTable companies={drillDown.companies} />}
      </Modal>
    </>
  );
}
