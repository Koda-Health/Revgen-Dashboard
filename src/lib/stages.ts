// src/lib/stages.ts
// Single source of truth for pipeline stages. Every consumer (sync, forecast,
// settings, views) must read stage slugs / ordering / labels from here.

export type Pipeline = "new_logo" | "renewal";

// New-logo funnel order (active, forecastable stages only).
export const NEW_LOGO_STAGE_ORDER = [
  "first_convo",
  "stakeholder_meeting_set",
  "stakeholder_meeting_complete",
  "building_business_case",
  "proposal_sent",
  "internal_review",
  "verbal_commit",
  "contract_sent",
  "contract_under_negotiation",
  "contract_in_signatures",
] as const;

// Renewal cumulative-product chain (EXCLUDES at-risk, which is out-of-band).
export const RENEWAL_CHAIN_ORDER = [
  "renewal_opportunity_identified",
  "renewal_value_meeting_review",
  "renewal_proposal_next_year",
  "renewal_negotiating",
  "renewal_verbal_commit",
  "renewal_contracting",
] as const;

// Out-of-band renewal stage: pinned close rate, never in the chain.
export const RENEWAL_AT_RISK = "renewal_at_risk";

// Terminal stages.
export const NEW_LOGO_WON = "closed_won";
export const NEW_LOGO_LOST = "lost";
export const RENEWAL_WON = "renewal_renewed";
export const RENEWAL_LOST = "renewal_churn_lost";

export const WON_STAGES = new Set<string>([NEW_LOGO_WON, RENEWAL_WON]);
export const LOST_STAGES = new Set<string>([NEW_LOGO_LOST, RENEWAL_LOST]);

// All active (forecastable) stages per pipeline.
export const NEW_LOGO_ACTIVE: readonly string[] = NEW_LOGO_STAGE_ORDER;
export const RENEWAL_ACTIVE: readonly string[] = [...RENEWAL_CHAIN_ORDER, RENEWAL_AT_RISK];

// Pipeline membership for every stage slug (active + terminal).
export const STAGE_TO_PIPELINE: Record<string, Pipeline> = {
  ...Object.fromEntries(NEW_LOGO_STAGE_ORDER.map((s) => [s, "new_logo" as Pipeline])),
  closed_won: "new_logo",
  lost: "new_logo",
  ...Object.fromEntries(RENEWAL_CHAIN_ORDER.map((s) => [s, "renewal" as Pipeline])),
  renewal_at_risk: "renewal",
  renewal_renewed: "renewal",
  renewal_churn_lost: "renewal",
};

export function pipelineForStage(stage: string | null | undefined): Pipeline | null {
  if (!stage) return null;
  return STAGE_TO_PIPELINE[stage] ?? null;
}

export function chainForPipeline(p: Pipeline): readonly string[] {
  return p === "new_logo" ? NEW_LOGO_STAGE_ORDER : RENEWAL_CHAIN_ORDER;
}

// Display labels (used by Settings + views).
export const STAGE_LABELS: Record<string, string> = {
  first_convo: "First Conversation",
  stakeholder_meeting_set: "Stakeholder Meeting Set",
  stakeholder_meeting_complete: "Stakeholder Meeting Complete",
  building_business_case: "Building Business Case",
  proposal_sent: "Proposal Sent",
  internal_review: "Internal Review",
  verbal_commit: "Verbal Commit",
  contract_sent: "Contract Sent",
  contract_under_negotiation: "Contract Under Negotiation",
  contract_in_signatures: "Contract in Signatures",
  closed_won: "Closed-Won",
  lost: "Lost",
  renewal_opportunity_identified: "Opportunity Identified",
  renewal_value_meeting_review: "Value Meeting Review",
  renewal_proposal_next_year: "Proposal Plan for Next Year",
  renewal_at_risk: "At Risk",
  renewal_negotiating: "Negotiating",
  renewal_verbal_commit: "Verbal Commit",
  renewal_contracting: "Contracting",
  renewal_renewed: "Renewed",
  renewal_churn_lost: "Churn/Lost",
};

// Attio status title → internal slug. Keys are whitespace-normalized so the
// double space in Attio's "Renewal -  Negotiating" still resolves.
export function normalizeAttioTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

const ATTIO_STAGE_ENTRIES: [string, string][] = [
  ["First Conversation", "first_convo"],
  ["Stakeholder Meeting Set", "stakeholder_meeting_set"],
  ["Stakeholder Meeting Complete", "stakeholder_meeting_complete"],
  ["Building Business Case", "building_business_case"],
  ["Proposal Sent", "proposal_sent"],
  ["Internal Review", "internal_review"],
  ["Verbal Commit", "verbal_commit"],
  ["Contract Sent", "contract_sent"],
  ["Contract Under Negotiation", "contract_under_negotiation"],
  ["Contract in Signatures", "contract_in_signatures"],
  ["Closed-Won", "closed_won"],
  ["Lost", "lost"],
  ["Renewal - Opportunity Identified", "renewal_opportunity_identified"],
  ["Renewal - Value Meeting Review", "renewal_value_meeting_review"],
  ["Renewal - Proposal Plan for Next Year", "renewal_proposal_next_year"],
  ["Renewal - At Risk", "renewal_at_risk"],
  ["Renewal - Negotiating", "renewal_negotiating"],
  ["Renewal - Verbal Commit", "renewal_verbal_commit"],
  ["Renewal - Contracting", "renewal_contracting"],
  ["Renewal - Renewed", "renewal_renewed"],
  ["Renewal - Churn/Lost", "renewal_churn_lost"],
];

const ATTIO_STAGE_MAP = new Map(
  ATTIO_STAGE_ENTRIES.map(([title, slug]) => [normalizeAttioTitle(title), slug]),
);

export function attioStageToSlug(title: string | null): string | null {
  if (!title) return null;
  return ATTIO_STAGE_MAP.get(normalizeAttioTitle(title)) ?? null;
}

// Days before new-logo revenue starts after Closed-Won (implementation ramp).
export const IMPLEMENTATION_LAG_DAYS = 45;
