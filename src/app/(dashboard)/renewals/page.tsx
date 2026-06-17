import { TopBar } from "@/components/layout/TopBar";
import { PipelineClientSection } from "@/components/pipeline/PipelineClientSection";
import { getPipelineData } from "@/lib/pipeline-data";

export default async function RenewalDealsPage() {
  const data = await getPipelineData("renewal");
  return (
    <div>
      <TopBar title="Renewal Deals" exportId="export-content" />
      <div id="export-content" className="p-6 space-y-8">
        <PipelineClientSection data={data} variant="renewal" />
      </div>
    </div>
  );
}
