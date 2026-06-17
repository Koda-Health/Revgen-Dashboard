import { prisma } from "@/lib/prisma";
import pLimit from "p-limit";
import { attioStageToSlug, WON_STAGES, LOST_STAGES } from "@/lib/stages";

const ATTIO_BASE = "https://api.attio.com/v2";
const ATTIO_KEY = process.env.ATTIO_API_KEY;

type HistoricEntry = {
  active_from: string | null;
  active_until: string | null;
  // status-type attributes return a top-level "status" object (not wrapped in "value")
  status?: { title: string } | null;
  // select-type attributes return a top-level "option" object
  option?: { title: string } | null;
};

async function fetchHistoricAttribute(
  object: string,
  recordId: string,
  attribute: string
): Promise<HistoricEntry[]> {
  if (!ATTIO_KEY) throw new Error("ATTIO_API_KEY not set");
  const res = await fetch(
    `${ATTIO_BASE}/objects/${object}/records/${recordId}/attributes/${attribute}/values?show_historic=true`,
    { headers: { Authorization: `Bearer ${ATTIO_KEY}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attio history API ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.data ?? []) as HistoricEntry[];
}

function valueAtDate(entries: HistoricEntry[], targetDate: Date): HistoricEntry | null {
  const ts = targetDate.getTime();
  const candidates = entries.filter((e) => {
    const from = e.active_from ? new Date(e.active_from).getTime() : -Infinity;
    const until = e.active_until ? new Date(e.active_until).getTime() : Infinity;
    return from <= ts && ts < until;
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((best, e) => {
    const bestFrom = best.active_from ? new Date(best.active_from).getTime() : -Infinity;
    const eFrom = e.active_from ? new Date(e.active_from).getTime() : -Infinity;
    return eFrom > bestFrom ? e : best;
  });
}

function extractTitle(entry: HistoricEntry | null): string | null {
  if (!entry) return null;
  return entry.status?.title ?? entry.option?.title ?? null;
}

export type DealSnapshotInput = {
  dealId: string;
  name: string;
  companyId: string | null;
  value: number | null;
  stage: string | null;
  status: "active" | "won" | "lost" | "stalled" | null;
};

async function buildDealSnapshot(
  deal: { id: string; name: string; companyId: string | null; value: number | null },
  targetDate: Date
): Promise<DealSnapshotInput> {
  const stageHistory = await fetchHistoricAttribute("deals", deal.id, "stage");

  const stageEntry = valueAtDate(stageHistory, targetDate);
  const stageRaw = extractTitle(stageEntry);
  const stage = attioStageToSlug(stageRaw);

  let status: "active" | "won" | "lost" | "stalled" | null = null;
  if (stage && WON_STAGES.has(stage)) status = "won";
  else if (stage && LOST_STAGES.has(stage)) status = "lost";
  else if (stage) status = "active";

  return { dealId: deal.id, name: deal.name, companyId: deal.companyId, value: deal.value, stage, status };
}

export async function generateSnapshotManifest(targetDate: Date): Promise<string> {
  // Normalize to midnight UTC so timestamps from "2026-03-01" and "2026-03-01T15:30:00Z" both key to the same manifest
  const normalizedDate = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  ));

  // Return existing manifest if one already exists for this date (idempotent)
  const existing = await prisma.snapshotManifest.findFirst({
    where: { snapshotAt: normalizedDate },
  });
  if (existing) return existing.id;

  const deals = await prisma.deal.findMany({
    select: { id: true, name: true, companyId: true, value: true },
  });

  const limit = pLimit(8);
  const snapshots = await Promise.all(
    deals.map((d) =>
      limit(() =>
        buildDealSnapshot(
          { id: d.id, name: d.name, companyId: d.companyId ?? null, value: d.value != null ? Number(d.value) : null },
          normalizedDate
        ).catch((err: unknown) => {
          console.error(`[attio-snapshot] Failed to snapshot deal ${d.id} (${d.name}):`, err);
          return {
            dealId: d.id,
            name: d.name,
            companyId: d.companyId ?? null,
            value: d.value != null ? Number(d.value) : null,
            stage: null,
            status: null,
          };
        })
      )
    )
  );

  const manifest = await prisma.snapshotManifest.create({
    data: {
      snapshotAt: normalizedDate,
      dealCount: snapshots.length,
      deals: {
        create: snapshots.map((s) => ({
          dealId: s.dealId,
          name: s.name,
          companyId: s.companyId,
          value: s.value,
          stage: s.stage,
          status: s.status,
        })),
      },
    },
  });

  return manifest.id;
}
