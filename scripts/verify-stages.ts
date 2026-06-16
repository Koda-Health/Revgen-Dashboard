// scripts/verify-stages.ts
import assert from "node:assert";
import {
  attioStageToSlug, pipelineForStage, RENEWAL_ACTIVE, NEW_LOGO_STAGE_ORDER,
} from "../src/lib/stages";

// Double space in Attio's "Negotiating" still resolves.
assert.equal(attioStageToSlug("Renewal -  Negotiating"), "renewal_negotiating");
assert.equal(attioStageToSlug("First Conversation"), "first_convo");
assert.equal(attioStageToSlug("Renewal - Renewed"), "renewal_renewed");
assert.equal(attioStageToSlug("Bogus"), null);

// Membership routing.
assert.equal(pipelineForStage("contract_sent"), "new_logo");
assert.equal(pipelineForStage("renewal_at_risk"), "renewal");
assert.equal(pipelineForStage(null), null);

// At-risk is active for renewal but not in the chain.
assert.ok(RENEWAL_ACTIVE.includes("renewal_at_risk"));
assert.equal(NEW_LOGO_STAGE_ORDER.length, 10);

console.log("stages.ts OK");
