-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN "offeredSeatId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_offerToken_key" ON "WaitlistEntry"("offerToken");
