import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceModule } from './creatrice/creatrice.module';
import { PrismaService } from './prisma.service';
import { VenteModule } from './vente/vente.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

//- Module racine de l'application — c'est le point d'entrée de NestJS
//- Tous les modules métier sont importés ici pour être disponibles dans l'app
@Module({
  imports: [
    CreatriceModule, //- Gestion des créatrices et leurs taux de commission
    VenteModule, //- Enregistrement des ventes et calcul des commissions
    StatsModule, //- Statistiques globales et par créatrice
    AuthModule, //- Inscription, connexion et gestion des JWT

    //- Protection contre le brute force et les attaques par déni de service
    //- ttl: 60000 = fenêtre de temps de 60 secondes (en millisecondes)
    //- limit: 10 = maximum 10 requêtes par IP dans cette fenêtre
    //- Au-delà → erreur 429 Too Many Requests automatiquement
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    //- Validation des variables d'environnement au démarrage de l'app
    //- isGlobal: true = ConfigModule accessible partout sans réimporter
    //- validationSchema vérifie que toutes les variables requises sont présentes
    //- Si une variable manque → l'app refuse de démarrer avec un message explicite
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(), //- URL de connexion à la base Neon
        JWT_SECRET: Joi.string().required(), //- Clé secrète pour signer les tokens JWT
        PORT: Joi.number().default(3000), //- Port du serveur (3000 par défaut)
      }),
    }),
  ],

  controllers: [AppController],
  //- PrismaService est déclaré ici en plus des modules pour être accessible globalement
  providers: [AppService, PrismaService],
})
export class AppModule {}
