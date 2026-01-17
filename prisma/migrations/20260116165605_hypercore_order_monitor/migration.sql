/*
  Warnings:

  - You are about to drop the `ActivityLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `chainType` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ActivityLog_timestamp_idx";

-- DropIndex
DROP INDEX "ActivityLog_userId_idx";

-- DropIndex
DROP INDEX "Token_address_idx";

-- DropIndex
DROP INDEX "Token_address_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ActivityLog";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Token";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "OrderLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oid" BIGINT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "limitPx" TEXT NOT NULL,
    "sz" TEXT NOT NULL,
    "origSz" TEXT NOT NULL,
    "tif" TEXT NOT NULL,
    "cloid" TEXT,
    "isTrigger" BOOLEAN NOT NULL DEFAULT false,
    "triggerPx" TEXT,
    "reduceOnly" BOOLEAN NOT NULL DEFAULT false,
    "network" TEXT NOT NULL DEFAULT 'hypercore-mainnet',
    "blockNumber" BIGINT NOT NULL,
    "blockTime" DATETIME NOT NULL,
    "localTime" DATETIME NOT NULL,
    "builder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusFilter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "name", "walletAddress") SELECT "createdAt", "displayName", "id", "name", "walletAddress" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OrderLog_eventId_key" ON "OrderLog"("eventId");

-- CreateIndex
CREATE INDEX "OrderLog_userId_idx" ON "OrderLog"("userId");

-- CreateIndex
CREATE INDEX "OrderLog_status_idx" ON "OrderLog"("status");

-- CreateIndex
CREATE INDEX "OrderLog_coin_idx" ON "OrderLog"("coin");

-- CreateIndex
CREATE INDEX "OrderLog_blockTime_idx" ON "OrderLog"("blockTime");

-- CreateIndex
CREATE UNIQUE INDEX "StatusFilter_status_key" ON "StatusFilter"("status");

-- CreateIndex
CREATE INDEX "StatusFilter_enabled_idx" ON "StatusFilter"("enabled");
