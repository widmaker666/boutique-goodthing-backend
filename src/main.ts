import 'dotenv/config'; //- Charge les variables d'environnement (.env) en premier — avant tout le reste
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //- Derrière le proxy Railway, l'adresse vue par le serveur est celle du proxy : sans ce réglage la limite
  //- de débit (10 req/min, 5 pour la connexion) serait PARTAGÉE par tous les utilisateurs au lieu d'être
  //- par personne. 1 = on fait confiance à un seul proxy (celui de Railway).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  //- Helmet ajoute des headers de sécurité HTTP sur toutes les réponses
  //- Protège contre le clickjacking, le sniffing de contenu, les fuites d'infos sur la stack, etc.
  //- Placé en premier pour s'appliquer à toutes les réponses, y compris celles des middlewares suivants
  app.use(helmet());

  //- Origines autorisées pour CORS, configurables via CORS_ORIGINS (séparées par des virgules)
  //- Fallback '*' si la variable n'est pas définie (dev uniquement)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : '*';
  if (corsOrigins === '*' && process.env.NODE_ENV === 'production') {
    console.warn('[sécurité] CORS_ORIGINS non défini en production : toutes les origines sont autorisées. Définis CORS_ORIGINS (adresses des sites séparées par des virgules).');
  }
  app.enableCors({ origin: corsOrigins });

  //- Nécessaire pour Stripe — le webhook a besoin du body brut (non parsé) pour vérifier la signature
  app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

  //- Active la validation globale des DTOs sur toutes les routes
  //- transform: true permet la conversion automatique des types (ex: string → number pour les query params)
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  //- Démarre le serveur sur le port défini dans .env ou 3000 par défaut
  await app.listen(process.env.PORT ?? 3000);
}

//- void indique explicitement à TypeScript qu'on ignore la Promise retournée par bootstrap()
void bootstrap();
