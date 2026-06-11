-- AlterTable: add geranteId as nullable first (table has existing rows)
ALTER TABLE "Creatrice" ADD COLUMN "geranteId" TEXT;

-- Backfill: only one gérante exists in the current dataset, attach all
-- existing créatrices to her (Creatrice.userId was previously overloaded
-- to also store the creating gérante's id before invitation).
UPDATE "Creatrice" SET "geranteId" = 'abffa9c1-2178-4232-8e0a-e88c868dc200'
WHERE "geranteId" IS NULL;

-- Enforce NOT NULL now that all rows are backfilled
ALTER TABLE "Creatrice" ALTER COLUMN "geranteId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Creatrice" ADD CONSTRAINT "Creatrice_geranteId_fkey" FOREIGN KEY ("geranteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Creatrice_geranteId_idx" ON "Creatrice"("geranteId");
