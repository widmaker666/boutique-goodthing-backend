import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { PrismaService } from 'src/prisma.service';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [OwnershipModule],
  providers: [StatsService, PrismaService],
  controllers: [StatsController],
})
export class StatsModule {}
