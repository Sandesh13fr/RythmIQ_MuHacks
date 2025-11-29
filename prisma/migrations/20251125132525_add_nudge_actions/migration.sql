-- CreateTable
CREATE TABLE "nudge_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nudgeType" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "message" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "impact" DECIMAL(65,30),

    CONSTRAINT "nudge_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nudge_actions_userId_idx" ON "nudge_actions"("userId");

-- CreateIndex
CREATE INDEX "nudge_actions_status_idx" ON "nudge_actions"("status");

-- CreateIndex
CREATE INDEX "nudge_actions_createdAt_idx" ON "nudge_actions"("createdAt");

-- AddForeignKey
ALTER TABLE "nudge_actions" ADD CONSTRAINT "nudge_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
