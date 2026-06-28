-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "yarnCount" TEXT,
    "millName" TEXT,
    "lotNumber" TEXT,
    "color" TEXT,
    "weightPerUnit" REAL,
    "reorderLevel" REAL NOT NULL DEFAULT 10,
    "notes" TEXT,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "purchaseRate" REAL NOT NULL DEFAULT 0,
    "sellingMargin" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_InventoryItem" ("category", "createdAt", "id", "purchaseRate", "quantity", "sellingMargin", "sellingPrice", "unit", "updatedAt", "variant") SELECT "category", "createdAt", "id", "purchaseRate", "quantity", "sellingMargin", "sellingPrice", "unit", "updatedAt", "variant" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
