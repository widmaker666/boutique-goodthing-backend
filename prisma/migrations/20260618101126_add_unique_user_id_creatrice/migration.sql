/*
  Warnings:

  - A unique constraint covering the columns `[nom,creatriceId]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom,evenementId]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Creatrice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'DUO';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GERANTE_CREATRICE';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "evenementId" TEXT,
ALTER COLUMN "creatriceId" DROP NOT NULL,
ALTER COLUMN "quantite" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_nom_creatriceId_key" ON "Article"("nom", "creatriceId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_nom_evenementId_key" ON "Article"("nom", "evenementId");

-- CreateIndex
CREATE UNIQUE INDEX "Creatrice_userId_key" ON "Creatrice"("userId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
