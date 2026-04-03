import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceModule } from './creatrice/creatrice.module';
import { PrismaService } from './prisma.service';
import { VenteModule } from './vente/vente.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [CreatriceModule, VenteModule, StatsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
