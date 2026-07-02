/** Format a dollar amount compactly: $1.23M, $720K, $8,500 */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

/** Format an absolute delta for display with sign */
export function formatDelta(delta: number): { display: string; positive: boolean } {
  const positive = delta >= 0;
  const abs = Math.abs(delta);
  return { display: `${positive ? "+" : "−"}${formatCurrency(abs)}`, positive };
}

/** Format a ratio as percentage: 0.734 → "73.4%" */
export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export const SOURCE_LABELS: Record<string, string> = {
  conference:      "Conference",
  referral:        "Referral",
  organic_inbound: "Organic",
  paid_inbound:    "Paid",
  email_outbound:  "Outbound",
  linkedin:        "LinkedIn",
  other:           "Other",
  unknown:         "Unknown",
};

export const SALES_TYPE_LABELS: Record<string, string> = {
  vbc_enabler:   "VBC Enabler",
  health_system: "Health System",
  payor:         "Payor",
  aco:           "ACO",
  ffs:           "FFS",
  payvider:      "Payvider",
  unknown:       "Unknown",
};

export const DEAL_TYPE_LABELS: Record<string, string> = {
  new_logo:       "New Logo",
  expansion:      "Expansion",
  renewal:        "Renewal",
  lost_keep_warm: "Keep Warm",
  unknown:        "Unknown",
};

/** Shared type for bar chart breakdown data — used by pipeline-data and leads-data */
export type BreakdownEntry = { key: string; value: number; count: number };

export const TIER_LABELS: Record<string, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
  unknown: "No Tier",
};

export const COMPANY_STAGE_LABELS: Record<string, string> = {
  unaware:                    "Unaware",
  outreach:                   "Outreach",
  aware:                      "Aware",
  engaged:                    "Engaged",
  discovery_meeting_set:      "Discovery Meeting Set",
  discovery_meeting_complete: "Discovery Meeting Complete",
  // Deprecated (historical rows)
  opportunity: "Opportunity",
  customer:    "Customer",
  evangelist:  "Evangelist",
  unknown:     "Unknown",
};
