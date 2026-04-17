import { PrismaService } from 'src/prisma.service';
import { Module } from '@nestjs/common';
import { BoutiqueController } from './boutique.controller';
import { BoutiqueService } from './boutique.service';

@Module({
  controllers: [BoutiqueController],
  providers: [BoutiqueService, PrismaService],
})
export class BoutiqueModule {}
