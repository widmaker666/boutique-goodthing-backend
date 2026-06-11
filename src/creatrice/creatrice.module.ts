import { Module } from '@nestjs/common';
import { CreatriceService } from './creatrice.service';
import { CreatriceController } from './creatrice.controller';
import { PrismaService } from 'src/prisma.service';
import { EmailService } from 'src/email/email.service';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [OwnershipModule],
  controllers: [CreatriceController],
  providers: [CreatriceService, PrismaService, EmailService],
})
export class CreatriceModule {}
