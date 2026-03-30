import { Module } from '@nestjs/common';
import { CreatriceService } from './creatrice.service';
import { CreatriceController } from './creatrice.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CreatriceController],
  providers: [CreatriceService, PrismaService],
})
export class CreatriceModule {}
