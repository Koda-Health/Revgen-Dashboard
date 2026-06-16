// scripts/verify-close-rate.ts
import assert from "node:assert";
import { deriveCloseRates } from "../src/lib/close-rate";
import { NEW_LOGO_STAGE_ORDER, RENEWAL_CHAIN_ORDER } from "../src/lib/stages";

const newLogo = [
  ["first_convo", 0.95], ["stakeholder_meeting_set", 0.90],
  ["stakeholder_meeting_complete", 0.75], ["building_business_case", 0.70],
  ["proposal_sent", 0.60], ["internal_review", 0.50], ["verbal_commit", 0.90],
  ["contract_sent", 0.90], ["contract_under_negotiation", 0.95],
  ["contract_in_signatures", 0.99],
].map(([stage, conversionToNext]) => ({ stage: stage as string, conversionToNext: conversionToNext as number }));

const nl = deriveCloseRates(newLogo, NEW_LOGO_STAGE_ORDER);
assert.ok(Math.abs(nl.get("internal_review")! - 0.381) < 0.002, "internal_review ~38.1%");
assert.ok(Math.abs(nl.get("contract_in_signatures")! - 0.99) < 0.001, "contract_in_signatures 99%");
assert.ok(Math.abs(nl.get("first_convo")! - 0.103) < 0.002, "first_convo ~10.3%");

const renewal = [
  ["renewal_opportunity_identified", 0.98], ["renewal_value_meeting_review", 0.98],
  ["renewal_proposal_next_year", 0.98], ["renewal_negotiating", 0.98],
  ["renewal_verbal_commit", 0.99], ["renewal_contracting", 0.99],
].map(([stage, conversionToNext]) => ({ stage: stage as string, conversionToNext: conversionToNext as number }));

const rn = deriveCloseRates(renewal, RENEWAL_CHAIN_ORDER);
assert.ok(Math.abs(rn.get("renewal_opportunity_identified")! - 0.904) < 0.002, "renewal start ~90.4%");
assert.ok(!rn.has("renewal_at_risk"), "at-risk excluded from chain");

console.log("close-rate.ts OK");
