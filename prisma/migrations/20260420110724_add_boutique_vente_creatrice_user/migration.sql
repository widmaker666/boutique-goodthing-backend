-- AlterTable
ALTER TABLE "Vente" ADD COLUMN     "boutiqueId" TEXT;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;
