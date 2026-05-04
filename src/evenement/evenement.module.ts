import { Module } from '@nestjs/common';
import { EvenementController } from './evenement.controller';
import { EvenementService } from './evenement.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [EvenementController],
  providers: [EvenementService, PrismaService],
})
export class EvenementModule {}
