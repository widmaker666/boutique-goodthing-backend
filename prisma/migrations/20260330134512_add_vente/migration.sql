-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'CARTE');

-- CreateTable
CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "nomArticle" TEXT NOT NULL,
    "prixVente" DOUBLE PRECISION NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatriceId" TEXT NOT NULL,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_creatriceId_fkey" FOREIGN KEY ("creatriceId") REFERENCES "Creatrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
