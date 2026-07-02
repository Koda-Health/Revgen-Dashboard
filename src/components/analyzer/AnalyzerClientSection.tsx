// src/components/analyzer/AnalyzerClientSection.tsx
"use client";

import { useState } from "react";
import { SnapshotPanel } from "./SnapshotPanel";
import { CohortWaterfall } from "./CohortWaterfall";
import { AssumptionsAnalysis } from "./AssumptionsAnalysis";
import { PipelineVelocityChart } from "./PipelineVelocityChart";

type ManifestInfo = { id: string; date: string };

export function AnalyzerClientSection() {
  const [manifests, setManifests] = useState<{ a: ManifestInfo; b: ManifestInfo } | null>(null);

  return (
    <div className="space-y-8">
      <SnapshotPanel
        onReady={(idA, dateA, idB, dateB) =>
          setManifests({ a: { id: idA, date: dateA }, b: { id: idB, date: dateB } })
        }
      />
      {manifests && (
        <CohortWaterfall manifestIdA={manifests.a.id} manifestIdB={manifests.b.id} />
      )}
      <PipelineVelocityChart />
      <AssumptionsAnalysis snapshotManifest={manifests?.b ?? null} />
    </div>
  );
}
