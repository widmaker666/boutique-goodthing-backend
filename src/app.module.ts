import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceModule } from './creatrice/creatrice.module';
import { PrismaService } from './prisma.service';
import { VenteModule } from './vente/vente.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './auth/auth.module';

//- Module racine de l'application — c'est le point d'entrée de NestJS
//- Tous les modules métier sont importés ici pour être disponibles dans l'app
@Module({
  imports: [
    CreatriceModule, //- Gestion des créatrices et leurs taux de commission
    VenteModule, //- Enregistrement des ventes et calcul des commissions
    StatsModule, //- Statistiques globales et par créatrice
    AuthModule, //- Inscription, connexion et gestion des JWT
  ],
  controllers: [AppController],
  //- PrismaService est déclaré ici en plus des modules pour être accessible globalement
  providers: [AppService, PrismaService],
})
export class AppModule {}
