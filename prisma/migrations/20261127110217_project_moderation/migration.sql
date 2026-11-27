-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "workMode" TEXT NOT NULL,
    "city" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "moderationFlagsJson" TEXT NOT NULL DEFAULT '[]',
    "moderatedAt" DATETIME,
    "moderatedById" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("category", "city", "createdAt", "description", "id", "ownerId", "searchText", "stage", "status", "summary", "tagsJson", "title", "updatedAt", "workMode") SELECT "category", "city", "createdAt", "description", "id", "ownerId", "searchText", "stage", "status", "summary", "tagsJson", "title", "updatedAt", "workMode" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_createdAt_idx" ON "Project"("ownerId", "createdAt");
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");
CREATE INDEX "Project_moderationStatus_createdAt_idx" ON "Project"("moderationStatus", "createdAt");
CREATE INDEX "Project_searchText_idx" ON "Project"("searchText");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
