/*
  Warnings:

  - A unique constraint covering the columns `[memberId,boutiqueMemberId]` on the table `BoutiqueMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BoutiqueMember_memberId_boutiqueMemberId_key" ON "BoutiqueMember"("memberId", "boutiqueMemberId");
