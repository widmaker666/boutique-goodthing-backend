import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceModule } from './creatrice/creatrice.module';
import { PrismaService } from './prisma.service';
import { VenteModule } from './vente/vente.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { ExportModule } from './export/export.module';
import { BoutiqueModule } from './boutique/boutique.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';
import * as Joi from 'joi';
import { ScheduleModule } from '@nestjs/schedule';
import { StripeModule } from './stripe/stripe.module';
import { EvenementModule } from './evenement/evenement.module';
import { ArticleModule } from './article/article.module';

//- Module racine de l'application — c'est le point d'entrée de NestJS
//- Tous les modules métier sont importés ici pour être disponibles dans l'app
@Module({
  imports: [
    CreatriceModule, // Gestion des créatrices et leurs taux de commission
    VenteModule, // Enregistrement des ventes et calcul des commissions
    StatsModule, // Statistiques globales et par créatrice
    AuthModule, // Inscription, connexion et gestion des JWT
    ScheduleModule.forRoot(), //ScheduleModule.forRoot() initialise le système de tâches planifiées dans NestJS — sans ça, le décorateur @Cron()

    // Protection contre le brute force et les attaques par déni de service
    // ttl: 60000 = fenêtre de temps de 60 secondes (en millisecondes)
    // limit: 10 = maximum 10 requêtes par IP dans cette fenêtre
    // Au-delà → erreur 429 Too Many Requests automatiquement
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    // Validation des variables d'environnement au démarrage de l'app
    // isGlobal: true = ConfigModule accessible partout sans réimporter
    // validationSchema vérifie que toutes les variables requises sont présentes
    // Si une variable manque → l'app refuse de démarrer avec un message explicite
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(), // URL de connexion à la base Neon
        JWT_SECRET: Joi.string().required(), // Clé secrète pour signer les tokens JWT
        PORT: Joi.number().default(3000), // Port du serveur (3000 par défaut)
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        RESEND_API_KEY: Joi.string().required(),
        RESEND_OVERRIDE_EMAIL: Joi.string().optional(),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
        CORS_ORIGINS: Joi.string().optional(), // Liste d'origines autorisées séparées par des virgules
        APP_URL: Joi.string().required(), // URL publique de l'app (Stripe success/cancel)
      }),
    }),
    UserModule,
    ExportModule,
    BoutiqueModule,
    CloudinaryModule,
    EmailModule,
    StripeModule,
    EvenementModule,
    ArticleModule,
  ],

  controllers: [AppController],
  //- PrismaService est déclaré ici en plus des modules pour être accessible globalement
  providers: [
    AppService,
    PrismaService,
    //- Active le rate limiting (ThrottlerModule.forRoot) sur toutes les routes
    //- Sans ce provider, la config Throttler importée plus haut n'a aucun effet
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
