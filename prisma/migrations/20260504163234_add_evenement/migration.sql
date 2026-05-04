-- AlterTable
ALTER TABLE "Vente" ADD COLUMN     "evenementId" TEXT;

-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatriceId" TEXT NOT NULL,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_creatriceId_fkey" FOREIGN KEY ("creatriceId") REFERENCES "Creatrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
