-- New-logo stage additions
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'stakeholder_meeting_set';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'stakeholder_meeting_complete';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'building_business_case';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'internal_review';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'verbal_commit';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_sent';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_under_negotiation';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'contract_in_signatures';
-- Renewal stages
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_opportunity_identified';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_value_meeting_review';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_proposal_next_year';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_at_risk';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_negotiating';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_verbal_commit';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_contracting';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_renewed';
ALTER TYPE "DealStage" ADD VALUE IF NOT EXISTS 'renewal_churn_lost';

-- Pipeline enum
DO $$ BEGIN
  CREATE TYPE "Pipeline" AS ENUM ('new_logo', 'renewal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- StageAssumption.pipeline column
ALTER TABLE "StageAssumption"
  ADD COLUMN IF NOT EXISTS "pipeline" "Pipeline" NOT NULL DEFAULT 'new_logo';
