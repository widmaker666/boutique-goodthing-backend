import { Module } from '@nestjs/common';
import { EvenementController } from './evenement.controller';
import { EvenementService } from './evenement.service';
import { PrismaService } from 'src/prisma.service';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [OwnershipModule],
  controllers: [EvenementController],
  providers: [EvenementService, PrismaService],
})
export class EvenementModule {}
