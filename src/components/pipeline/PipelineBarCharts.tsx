"use client";

import { useState } from "react";
import { PipelineBarChart } from "@/components/pipeline/PipelineBarChart";
import { Modal } from "@/components/ui/Modal";
import { DealTable } from "@/components/ui/DealTable";
import { SOURCE_LABELS, SALES_TYPE_LABELS, DEAL_TYPE_LABELS } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/stages";
import type { PipelineData } from "@/lib/pipeline-data";
import type { DealRow } from "@/components/ui/DealTable";

type DrillDown = { title: string; deals: DealRow[] } | null;

export function PipelineBarCharts({ data }: { data: PipelineData }) {
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  function handleClick(
    dimension: "stage" | "source" | "dealType" | "companyType",
    key: string
  ) {
    let filtered: DealRow[];
    if (dimension === "stage")           filtered = data.activeDeals.filter((d) => d.stage === key);
    else if (dimension === "source")      filtered = data.activeDeals.filter((d) => d.source === key);
    else if (dimension === "dealType")    filtered = data.activeDeals.filter((d) => d.typeOfDeal === key);
    else /* companyType */                filtered = data.activeDeals.filter((d) => d.companyType === key);

    const labelMap = {
      stage: STAGE_LABELS,
      source: SOURCE_LABELS,
      dealType: DEAL_TYPE_LABELS,
      companyType: SALES_TYPE_LABELS,
    };
    const title = labelMap[dimension][key] ?? key;
    setDrillDown({ title, deals: filtered });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6">
        <PipelineBarChart
          title="By Stage"
          data={data.byStage}
          labelMap={STAGE_LABELS}
          onBarClick={(k) => handleClick("stage", k)}
        />
        <PipelineBarChart
          title="By Source"
          data={data.bySource}
          labelMap={SOURCE_LABELS}
          onBarClick={(k) => handleClick("source", k)}
        />
        <PipelineBarChart
          title="By Company Type"
          data={data.byCompanyType}
          labelMap={SALES_TYPE_LABELS}
          onBarClick={(k) => handleClick("companyType", k)}
        />
        <PipelineBarChart
          title="By Deal Type"
          data={data.byDealType}
          labelMap={DEAL_TYPE_LABELS}
          onBarClick={(k) => handleClick("dealType", k)}
        />
      </div>
      <Modal
        open={drillDown != null}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title ?? ""}
        width="xl"
      >
        {drillDown && <DealTable deals={drillDown.deals} />}
      </Modal>
    </>
  );
}
