-- DropIndex
DROP INDEX "OrderLog_eventId_key";

-- CreateIndex
CREATE UNIQUE INDEX "OrderLog_eventId_status_key" ON "OrderLog"("eventId", "status");
