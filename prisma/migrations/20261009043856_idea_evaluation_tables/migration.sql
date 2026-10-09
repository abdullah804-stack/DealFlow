-- CreateTable
CREATE TABLE "idea_evaluations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "oneLiner" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "targetMarket" TEXT,
    "businessModel" TEXT,
    "teamBackground" TEXT,
    "competitors" TEXT,
    "fundingStage" TEXT,
    "askAmount" TEXT,
    "status" TEXT NOT NULL DEFAULT 'intake',
    "failureReason" TEXT,
    "candidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interviewing',
    "currentQuestionKey" TEXT,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "specialist" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "isClarification" BOOLEAN NOT NULL DEFAULT false,
    "answerText" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "interview_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idea_evaluations_candidateId_key" ON "idea_evaluations"("candidateId");

-- CreateIndex
CREATE INDEX "idea_evaluations_userId_idx" ON "idea_evaluations"("userId");

-- CreateIndex
CREATE INDEX "idea_evaluations_status_idx" ON "idea_evaluations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_evaluationId_key" ON "interview_sessions"("evaluationId");

-- CreateIndex
CREATE INDEX "interview_turns_sessionId_idx" ON "interview_turns"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turns_sessionId_turnIndex_key" ON "interview_turns"("sessionId", "turnIndex");

-- AddForeignKey
ALTER TABLE "idea_evaluations" ADD CONSTRAINT "idea_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_evaluations" ADD CONSTRAINT "idea_evaluations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "idea_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
