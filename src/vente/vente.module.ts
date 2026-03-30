import { Module } from '@nestjs/common';
import { VenteService } from './vente.service';
import { VenteController } from './vente.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [VenteController],
  providers: [VenteService, PrismaService],
})
export class VenteModule {}
