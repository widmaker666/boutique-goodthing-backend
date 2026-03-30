import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceModule } from './creatrice/creatrice.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [CreatriceModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
