import 'dotenv/config'; //- Charge les variables d'environnement (.env) en premier — avant tout le reste
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //- Nécessaire pour Stripe — le webhook a besoin du body brut (non parsé) pour vérifier la signature
  app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

  //- Active la validation globale des DTOs sur toutes les routes
  //- transform: true permet la conversion automatique des types (ex: string → number pour les query params)
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  //- Helmet ajoute des headers de sécurité HTTP sur toutes les réponses
  //- Protège contre le clickjacking, le sniffing de contenu, les fuites d'infos sur la stack, etc.
  app.use(helmet());

  //- Démarre le serveur sur le port défini dans .env ou 3000 par défaut
  await app.listen(process.env.PORT ?? 3000);
}

//- void indique explicitement à TypeScript qu'on ignore la Promise retournée par bootstrap()
void bootstrap();
