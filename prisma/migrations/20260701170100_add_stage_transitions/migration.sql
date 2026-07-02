-- Stage transition history for velocity analytics (SP6)
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "pipeline" "Pipeline" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "durationDays" INTEGER,
    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageTransition_dealId_idx" ON "StageTransition"("dealId");
CREATE INDEX "StageTransition_stage_idx" ON "StageTransition"("stage");
CREATE INDEX "StageTransition_exitedAt_idx" ON "StageTransition"("exitedAt");

ALTER TABLE "StageTransition"
    ADD CONSTRAINT "StageTransition_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
