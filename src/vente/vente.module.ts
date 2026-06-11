import { Module } from '@nestjs/common';
import { VenteService } from './vente.service';
import { VenteController } from './vente.controller';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { EmailModule } from 'src/email/email.module';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [CloudinaryModule, EmailModule, OwnershipModule],
  controllers: [VenteController],
  providers: [VenteService, PrismaService],
})
export class VenteModule {}
