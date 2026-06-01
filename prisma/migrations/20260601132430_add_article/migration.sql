-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prixIndicatif" DOUBLE PRECISION,
    "photo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatriceId" TEXT NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_creatriceId_fkey" FOREIGN KEY ("creatriceId") REFERENCES "Creatrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
