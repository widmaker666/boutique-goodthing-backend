-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INVITE', 'SUSPENDUE');

-- CreateTable
CREATE TABLE "Boutique" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geranteId" TEXT NOT NULL,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoutiqueMember" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "boutiqueMemberId" TEXT NOT NULL,
    "planMember" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "Status" NOT NULL DEFAULT 'INVITE',

    CONSTRAINT "BoutiqueMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Boutique" ADD CONSTRAINT "Boutique_geranteId_fkey" FOREIGN KEY ("geranteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoutiqueMember" ADD CONSTRAINT "BoutiqueMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoutiqueMember" ADD CONSTRAINT "BoutiqueMember_boutiqueMemberId_fkey" FOREIGN KEY ("boutiqueMemberId") REFERENCES "Boutique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
