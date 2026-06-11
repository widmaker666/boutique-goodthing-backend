import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PrismaService } from 'src/prisma.service';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [OwnershipModule],
  controllers: [ExportController],
  providers: [ExportService, PrismaService],
})
export class ExportModule {}
