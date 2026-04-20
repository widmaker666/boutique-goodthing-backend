import { Module } from '@nestjs/common';
import { VenteService } from './vente.service';
import { VenteController } from './vente.controller';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [CloudinaryModule, EmailModule],
  controllers: [VenteController],
  providers: [VenteService, PrismaService],
})
export class VenteModule {}
