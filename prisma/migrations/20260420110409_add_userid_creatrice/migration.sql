-- AlterTable
ALTER TABLE "Creatrice" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Creatrice" ADD CONSTRAINT "Creatrice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
