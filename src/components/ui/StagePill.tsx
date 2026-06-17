import { STAGE_LABELS } from "@/lib/stages";

const STAGE_STYLES: Record<string, string> = {
  // --- Legacy / old-slug stages (kept for historical rows) ---
  opp_qual:     "bg-indigo-50 text-indigo-700",
  stakeholder:  "bg-purple-50 text-purple-700",
  verbal:       "bg-teal-50 text-teal-700",
  contracting:  "bg-emerald-50 text-emerald-700",

  // --- New-logo funnel: early (light/cool tones) ---
  first_convo:                  "bg-sky-50 text-sky-700",
  stakeholder_meeting_set:      "bg-cyan-50 text-cyan-700",
  stakeholder_meeting_complete: "bg-blue-50 text-blue-700",

  // --- New-logo funnel: mid (indigo/blue tones) ---
  building_business_case: "bg-indigo-50 text-indigo-700",
  proposal_sent:          "bg-violet-50 text-violet-700",
  internal_review:        "bg-purple-50 text-purple-700",

  // --- New-logo funnel: late (amber → emerald progressing to green) ---
  verbal_commit:              "bg-amber-50 text-amber-700",
  contract_sent:              "bg-yellow-50 text-yellow-700",
  contract_under_negotiation: "bg-lime-50 text-lime-700",
  contract_in_signatures:     "bg-emerald-50 text-emerald-700",

  // --- New-logo terminal ---
  closed_won:   "bg-green-100 text-green-800",
  lost:         "bg-rose-50 text-rose-700",

  // --- Renewal chain (distinct teal/cyan family) ---
  renewal_opportunity_identified: "bg-teal-50 text-teal-700",
  renewal_value_meeting_review:   "bg-cyan-50 text-cyan-700",
  renewal_proposal_next_year:     "bg-sky-50 text-sky-700",
  renewal_negotiating:            "bg-teal-50 text-teal-700",
  renewal_verbal_commit:          "bg-emerald-50 text-emerald-700",
  renewal_contracting:            "bg-emerald-50 text-emerald-700",

  // --- Renewal special / terminal ---
  renewal_at_risk:    "bg-orange-50 text-orange-700",
  renewal_renewed:    "bg-green-100 text-green-800",
  renewal_churn_lost: "bg-rose-50 text-rose-700",

  // --- Generic status pills ---
  active:       "bg-blue-50 text-blue-700",
  stalled:      "bg-yellow-50 text-yellow-700",
  won:          "bg-green-100 text-green-800",
};

type Props = { value: string; type?: "stage" | "status" };

export function StagePill({ value, type = "stage" }: Props) {
  const style = STAGE_STYLES[value] ?? "bg-slate-100 text-slate-600";
  const label =
    type === "stage"
      ? (STAGE_LABELS[value] ?? value)
      : value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight ${style}`}>
      {label}
    </span>
  );
}
