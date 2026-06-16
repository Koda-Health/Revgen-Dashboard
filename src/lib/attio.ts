import pLimit from "p-limit";
import { attioStageToSlug } from "@/lib/stages";

const ATTIO_BASE = "https://api.attio.com/v2";
const ATTIO_KEY = process.env.ATTIO_API_KEY;
if (!ATTIO_KEY) throw new Error("ATTIO_API_KEY environment variable is not set");

// ─── Generic fetch helper ────────────────────────────────────────────────────

async function attioQuery(objectSlug: string, body: object = {}) {
  const allRecords: AttioRecord[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(
      `${ATTIO_BASE}/objects/${objectSlug}/records/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ATTIO_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, limit, offset }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Attio API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const records: AttioRecord[] = json.data ?? [];
    allRecords.push(...records);

    if (records.length < limit) break;
    offset += limit;
  }

  return allRecords;
}

// ─── Value extractors ────────────────────────────────────────────────────────

type AttioValue = {
  value?: string | number | null;
  currency_value?: number | null;
  status?: { title: string } | null;
  option?: { title: string } | null;
  target_record_id?: string | null;
};

export type AttioRecord = {
  id: { record_id: string };
  values: Record<string, AttioValue[]>;
};

function getText(record: AttioRecord, slug: string): string | null {
  const v = record.values[slug]?.[0]?.value;
  return typeof v === "string" ? v : null;
}

function getNumber(record: AttioRecord, slug: string): number | null {
  const v = record.values[slug]?.[0];
  if (!v) return null;
  const raw = v.value ?? v.currency_value;
  if (typeof raw === "number") return raw;
  // Attio may return numeric fields as strings
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return isNaN(parsed) ? null : parsed;
  }
  // Attio may store numeric values as select/option titles (e.g. icp_tier "1", "2", "3")
  if (v.option?.title) {
    const parsed = Number(v.option.title);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getStatus(record: AttioRecord, slug: string): string | null {
  const v = record.values[slug]?.[0];
  if (!v) return null;
  return v.status?.title ?? v.option?.title ?? null;
}

function getDate(record: AttioRecord, slug: string): Date | null {
  const v = record.values[slug]?.[0]?.value;
  return typeof v === "string" ? new Date(v) : null;
}

function getRef(record: AttioRecord, slug: string): string | null {
  return record.values[slug]?.[0]?.target_record_id ?? null;
}

// ─── Attio → internal slug maps ──────────────────────────────────────────────

const SOURCE_MAP: Record<string, string> = {
  "Event or Conference": "conference",
  "Referral":            "referral",
  "Organic Inbound":     "organic_inbound",
  "Paid Inbound":        "paid_inbound",
  "Email Outbound":      "email_outbound",
  "LinkedIn":            "linkedin",
  "Other":               "other",
};

const COMPANY_STAGE_MAP: Record<string, string> = {
  "Unaware":     "unaware",
  "Aware":       "aware",
  "Engaged":     "engaged",
  "Opportunity": "opportunity",
  "Customer":    "customer",
  "Evangelist":  "evangelist",
};

const SALES_TYPE_MAP: Record<string, string> = {
  "VBC Enabler":   "vbc_enabler",
  "Health System": "health_system",
  "Payor":         "payor",
  "ACO":           "aco",
  "FFS":           "ffs",
  "Payvider":      "payvider",
};

const DEAL_TYPE_MAP: Record<string, string> = {
  "New Logo":       "new_logo",
  "Expansion":      "expansion",
  "Renewal":        "renewal",
  "Lost Keep Warm": "lost_keep_warm",
};

const PRODUCT_LINE_MAP: Record<string, string> = {
  "ACP":      "acp",
  "Kidney":   "kidney",
  "CHF":      "chf",
  "Oncology": "oncology",
};

const PAYMENT_MAP: Record<string, string> = {
  "Enterprise":   "enterprise",
  "PMPM":         "pmpm",
  "Success Fee":  "success_fee",
};

const BUDGET_CYCLE_MAP: Record<string, string> = {
  "Q1": "Q1",
  "Q2": "Q2",
  "Q3": "Q3",
  "Q4": "Q4",
};

// ─── Typed output types ───────────────────────────────────────────────────────

export type AttioDeal = {
  id: string;
  name: string;
  companyId: string | null;
  value: number | null;
  stage: string | null;
  source: string | null;
  typeOfDeal: string | null;
  productLine: string | null;
  paymentStructure: string | null;
  // undefined = leave DB value alone (Prisma semantics); null = explicitly clear
  firstConvoDate: Date | null | undefined;
  expectedClosedDate: Date | null;
  closeDate: Date | null;
  implementationFeeValue: number | null;
  integrationFeeValue: number | null;
  attioCreatedAt: Date | null;
  attioUpdatedAt: Date | null;
};

export type AttioCompany = {
  id: string;
  name: string;
  salesType: string | null;
  companyStage: string | null;
  icpTier: number | null;
  icpFitScore: number | null;
  patientPopulation: number | null;
  budgetCycle: string | null;
  attioCreatedAt: Date | null;
  attioUpdatedAt: Date | null;
};

// ─── Public fetch functions ───────────────────────────────────────────────────

export async function fetchDeals(): Promise<AttioDeal[]> {
  const records = await attioQuery("deals");
  return records.map((r) => ({
    id: r.id.record_id,
    name: getText(r, "name") ?? "(unnamed)",
    companyId: getRef(r, "associated_company"),
    value: getNumber(r, "value"),
    stage: attioStageToSlug(getStatus(r, "stage")),
    source: mapOrNull(getStatus(r, "deal_source_3"), SOURCE_MAP),
    typeOfDeal: mapOrNull(getStatus(r, "type_of_deal"), DEAL_TYPE_MAP),
    productLine: mapOrNull(getStatus(r, "product_line"), PRODUCT_LINE_MAP),
    paymentStructure: mapOrNull(getStatus(r, "payment_structure"), PAYMENT_MAP),
    // firstConvoDate is derived from stage history (see fetchDealStageHistories), not from a manual custom field
    firstConvoDate: null,
    expectedClosedDate: getDate(r, "expected_closed_date"),
    closeDate: getDate(r, "close_date"),
    implementationFeeValue: getNumber(r, "implementation_fee_value"),
    integrationFeeValue: getNumber(r, "integration_fee_value"),
    attioCreatedAt: getDate(r, "created_at"),
    attioUpdatedAt: getDate(r, "updated_at"),
  }));
}

export async function fetchCompanies(): Promise<AttioCompany[]> {
  const records = await attioQuery("companies");
  return records.map((r) => ({
    id: r.id.record_id,
    name: getText(r, "name") ?? "(unnamed)",
    salesType: mapOrNull(getStatus(r, "sales_type"), SALES_TYPE_MAP),
    companyStage: mapOrNull(getStatus(r, "activation"), COMPANY_STAGE_MAP),
    icpTier: getNumber(r, "icp_tier"),
    icpFitScore: getNumber(r, "icp_fit_score"),
    patientPopulation: getNumber(r, "patient_member_population"),
    budgetCycle: mapOrNull(getStatus(r, "budget_cycle"), BUDGET_CYCLE_MAP),
    attioCreatedAt: getDate(r, "created_at"),
    attioUpdatedAt: getDate(r, "updated_at"),
  }));
}

function mapOrNull(value: string | null, map: Record<string, string>): string | null {
  if (!value) return null;
  return map[value] ?? null;
}

// ─── Stage history (firstConvoDate source of truth) ──────────────────────────

type StageHistoryEntry = {
  active_from: string | null;
  active_until: string | null;
  status?: { title: string } | null;
};

async function fetchDealStageHistory(dealId: string): Promise<StageHistoryEntry[]> {
  const res = await fetch(
    `${ATTIO_BASE}/objects/deals/records/${dealId}/attributes/stage/values?show_historic=true`,
    { headers: { Authorization: `Bearer ${ATTIO_KEY}` } }
  );
  if (!res.ok) throw new Error(`Attio ${res.status} for deal ${dealId} stage history`);
  const json = await res.json();
  return (json.data ?? []) as StageHistoryEntry[];
}

function deriveFirstConvoDate(history: StageHistoryEntry[]): Date | null {
  const firstConvoEntries = history.filter((e) => e.status?.title === "First Conversation");
  if (firstConvoEntries.length === 0) return null;
  const earliest = firstConvoEntries.reduce((acc, e) => {
    if (!e.active_from) return acc;
    if (!acc.active_from) return e;
    return new Date(e.active_from) < new Date(acc.active_from) ? e : acc;
  });
  return earliest.active_from ? new Date(earliest.active_from) : null;
}

export async function fetchDealStageHistories(
  dealIds: string[]
): Promise<Map<string, Date | null>> {
  const limit = pLimit(8);
  const out = new Map<string, Date | null>();
  await Promise.all(
    dealIds.map((id) =>
      limit(async () => {
        try {
          const history = await fetchDealStageHistory(id);
          out.set(id, deriveFirstConvoDate(history));
        } catch (err) {
          // On failure, leave the map entry unset so the upsert preserves the existing DB value
          console.error(`[attio] stage history failed for ${id}:`, err);
        }
      })
    )
  );
  return out;
}
