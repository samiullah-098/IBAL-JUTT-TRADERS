/*
  Warnings:

  - You are about to drop the column `profileImage` on the `Party` table. All the data in the column will be lost.
  - You are about to drop the column `totalBilled` on the `Party` table. All the data in the column will be lost.
  - You are about to drop the column `totalPaid` on the `Party` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `netAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Transaction` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "phone" TEXT,
    "shopName" TEXT,
    "cnic" TEXT,
    "ntn" TEXT,
    "city" TEXT,
    "address" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "outstanding" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Party" ("address", "createdAt", "id", "name", "outstanding", "phone", "type", "updatedAt") SELECT "address", "createdAt", "id", "name", "outstanding", "phone", "type", "updatedAt" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "proofImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "id", "partyId", "paymentMethod", "proofImage", "type") SELECT "amount", "createdAt", "id", "partyId", "paymentMethod", "proofImage", "type" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
