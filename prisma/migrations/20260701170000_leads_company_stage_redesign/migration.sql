-- Leads company-stage redesign (SP5): add new lead-funnel stages.
-- Existing values (unaware, aware, engaged, opportunity, customer, evangelist) are kept;
-- opportunity/customer/evangelist are now deprecated but retained for historical rows.
ALTER TYPE "CompanyStage" ADD VALUE IF NOT EXISTS 'outreach';
ALTER TYPE "CompanyStage" ADD VALUE IF NOT EXISTS 'discovery_meeting_set';
ALTER TYPE "CompanyStage" ADD VALUE IF NOT EXISTS 'discovery_meeting_complete';
