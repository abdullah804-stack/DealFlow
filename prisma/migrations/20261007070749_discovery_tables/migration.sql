-- CreateTable
CREATE TABLE "daily_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "candidatesFound" INTEGER NOT NULL DEFAULT 0,
    "candidatesValidated" INTEGER NOT NULL DEFAULT 0,
    "candidatesEscalated" INTEGER NOT NULL DEFAULT 0,
    "topPickId" TEXT,
    "errorMessage" TEXT,
    "llmCallCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rawText" TEXT,
    "metadata" JSONB,
    "discoveryConfidence" DOUBLE PRECISION,
    "finalConfidence" DOUBLE PRECISION,
    "validationReasoning" TEXT,
    "rank" INTEGER,
    "isRealStartup" BOOLEAN NOT NULL DEFAULT false,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyRunId" TEXT,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "dossierJson" JSONB NOT NULL,
    "summary" TEXT,
    "company" TEXT,
    "industry" TEXT,
    "technology" TEXT,
    "competitors" JSONB,
    "fundingStatus" TEXT,
    "pricingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyRunId" TEXT,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceType" TEXT,
    "supportLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_assessments" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "risks" JSONB,
    "assumptions" JSONB,
    "unknowns" JSONB,
    "recommendedActions" JSONB,
    "evidenceIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_decisions" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "fastPath" TEXT,
    "rubricVersion" TEXT NOT NULL DEFAULT '1.0',
    "round1Opinions" JSONB,
    "round2Opinions" JSONB,
    "debateSummary" TEXT,
    "roundComparison" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "dossierId" TEXT,
    "decisionId" TEXT,
    "dailyRunId" TEXT,
    "subjectType" TEXT NOT NULL DEFAULT 'candidate',
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "reportJson" JSONB NOT NULL,
    "contentHash" TEXT,
    "pdfBlobUrl" TEXT,
    "company" TEXT,
    "decision" TEXT,
    "weightedScore" DOUBLE PRECISION,
    "starRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_logs" (
    "id" TEXT NOT NULL,
    "dailyRunId" TEXT,
    "agentType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_runs_startedAt_idx" ON "daily_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_canonicalKey_key" ON "candidates"("canonicalKey");

-- CreateIndex
CREATE INDEX "candidates_firstSeen_idx" ON "candidates"("firstSeen");

-- CreateIndex
CREATE INDEX "candidates_source_idx" ON "candidates"("source");

-- CreateIndex
CREATE INDEX "candidates_dailyRunId_idx" ON "candidates"("dailyRunId");

-- CreateIndex
CREATE INDEX "dossiers_candidateId_idx" ON "dossiers"("candidateId");

-- CreateIndex
CREATE INDEX "dossiers_createdAt_idx" ON "dossiers"("createdAt");

-- CreateIndex
CREATE INDEX "evidence_candidateId_idx" ON "evidence"("candidateId");

-- CreateIndex
CREATE INDEX "agent_assessments_candidateId_idx" ON "agent_assessments"("candidateId");

-- CreateIndex
CREATE INDEX "agent_assessments_agentType_idx" ON "agent_assessments"("agentType");

-- CreateIndex
CREATE INDEX "committee_decisions_candidateId_idx" ON "committee_decisions"("candidateId");

-- CreateIndex
CREATE INDEX "committee_decisions_dossierId_idx" ON "committee_decisions"("dossierId");

-- CreateIndex
CREATE INDEX "committee_decisions_decision_idx" ON "committee_decisions"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "reports_contentHash_key" ON "reports"("contentHash");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "reports_subjectType_idx" ON "reports"("subjectType");

-- CreateIndex
CREATE INDEX "agent_run_logs_dailyRunId_idx" ON "agent_run_logs"("dailyRunId");

-- CreateIndex
CREATE INDEX "agent_run_logs_createdAt_idx" ON "agent_run_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_assessments" ADD CONSTRAINT "agent_assessments_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_decisions" ADD CONSTRAINT "committee_decisions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_decisions" ADD CONSTRAINT "committee_decisions_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "committee_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_logs" ADD CONSTRAINT "agent_run_logs_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
