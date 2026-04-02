# 🛍️ Boutique Backend

![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs) ![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?logo=prisma) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql) ![Node](https://img.shields.io/badge/Node.js-v22-339933?logo=nodedotjs)

API REST de suivi des ventes pour une boutique de créateurs. Permet de gérer les créatrices, d'enregistrer les ventes et de calculer automatiquement les commissions.

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| NestJS | Framework backend |
| Prisma v7 | ORM |
| PostgreSQL (Neon) | Base de données cloud |
| class-validator | Validation des DTOs |
| class-transformer | Transformation des types |
| Jest + Supertest | Tests unitaires et e2e |
| Stripe | Paiements et abonnements |
| React Native + Expo | Application mobile iOS & Android |

---

## Architecture

```
Requête HTTP
     │
     ▼
 Controller        ← reçoit la requête, délègue au service
     │
     ▼
  Service          ← logique métier, calculs de commission
     │
     ▼
PrismaService      ← accès à la base de données
     │
     ▼
 PostgreSQL        ← Neon (cloud)
```

---

## Prérequis

- Node.js v18+
- Un compte [Neon](https://neon.tech) pour la base de données

---

## Installation

```bash
# Cloner le projet
git clone <url-du-repo>
cd boutique-backend

# Installer les dépendances
npm install --legacy-peer-deps

# Configurer les variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL avec votre URL Neon

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Démarrer en développement
npm run start:dev
```

---

## Variables d'environnement

```env
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=verify-full"
```

---

## Scripts disponibles

```bash
npm run start:dev      # Démarrage en mode watch (développement)
npm run start:prod     # Démarrage en production
npm run build          # Compilation TypeScript
npm run lint           # Vérification ESLint
npm run test           # Tests unitaires
npm run test:e2e       # Tests end-to-end

npx prisma generate    # Générer le client Prisma
npx prisma migrate dev # Créer et appliquer une migration
npx prisma studio      # Interface graphique de la BDD
```

---

## Modules

### Creatrice `/creatrice`

Gestion des créatrices et de leurs taux de commission.

| Méthode | Route | Description |
|--------|-------|-------------|
| GET | `/creatrice` | Liste toutes les créatrices |
| GET | `/creatrice/:id` | Récupère une créatrice |
| POST | `/creatrice` | Crée une créatrice |
| PATCH | `/creatrice/:id` | Met à jour une créatrice |
| DELETE | `/creatrice/:id` | Supprime une créatrice |

**Filtres disponibles** sur `GET /creatrice` :
- `nom` — recherche par nom exact
- `minCommision` / `maxCommision` — filtre par intervalle de commission

**Exemple de body (POST) :**
```json
{
  "nom": "Marie",
  "email": "marie@example.com",
  "telephone": "0612345678",
  "tauxDeCommission": 30
}
```

---

### Vente `/vente`

Enregistrement des ventes avec calcul automatique des commissions.

| Méthode | Route | Description |
|--------|-------|-------------|
| GET | `/vente` | Liste toutes les ventes |
| GET | `/vente/:id` | Récupère une vente |
| POST | `/vente` | Crée une vente |
| PATCH | `/vente/:id` | Met à jour une vente |
| DELETE | `/vente/:id` | Supprime une vente |

**Filtres disponibles** sur `GET /vente` :
- `nomArticle` — recherche par nom d'article
- `minPrixVente` / `maxPrixVente` — filtre par intervalle de prix
- `modePaiement` — `ESPECES` ou `CARTE`

**Exemple de body (POST) :**
```json
{
  "nomArticle": "Collier fleurs",
  "prixVente": 25,
  "modePaiement": "CARTE",
  "creatriceId": "uuid-de-la-creatrice"
}
```

**Exemple de réponse :**
```json
{
  "id": "...",
  "nomArticle": "Collier fleurs",
  "prixVente": 25,
  "modePaiement": "CARTE",
  "createdAt": "2026-03-30T15:09:47.767Z",
  "creatrice": { "nom": "Marie", "tauxDeCommission": 30 },
  "montantCommission": 7.5,
  "netCreatrice": 17.5
}
```

---

## Gestion des erreurs

| Code HTTP | Description |
|-----------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Données invalides (validation échouée) |
| 404 | Ressource introuvable |
| 500 | Erreur serveur interne |

---

## Modèle de données

```prisma
model Creatrice {
  id               String   @id @default(uuid())
  nom              String
  email            String?
  telephone        String?
  tauxDeCommission Float
  createdAt        DateTime @default(now())
  vente            Vente[]
}

model Vente {
  id           String       @id @default(uuid())
  nomArticle   String
  prixVente    Float
  modePaiement ModePaiement
  createdAt    DateTime     @default(now())
  creatrice    Creatrice    @relation(fields: [creatriceId], references: [id])
  creatriceId  String
}

enum ModePaiement {
  ESPECES
  CARTE
}
```

---

## Plans

| Fonctionnalité | Gratuit | Pro (9€/mois ou 79€/an) |
|----------------|---------|--------------------------|
| Créatrices | 3 max | Illimitées |
| Boutiques | 1 | Multi-boutiques |
| Stats | Basiques | Avancées |
| Exports PDF/Excel | Aperçu flouté | Complets |
| Support | — | Prioritaire |

---

## Roadmap

**Backend**
- [x] Module `creatrice` — CRUD + filtres + validation
- [x] Module `vente` — CRUD + filtres + calcul commission automatique
- [ ] Tests unitaires et e2e — Jest + Supertest
- [ ] Module `stats` — bilan global et par créatrice (TDD)
- [ ] Module `auth` — inscription, connexion, JWT (TDD)
- [ ] Module `user` — profil, gestion du plan (TDD)
- [ ] Module `boutique` — multi-boutiques (TDD)
- [ ] Module `export` — PDF + Excel
- [ ] Module `stripe` — abonnements mensuel/annuel

**Mobile**
- [ ] Application React Native + Expo (iOS & Android)
- [ ] Écrans d'authentification
- [ ] Dashboard des ventes
- [ ] Gestion des créatrices
- [ ] Stats et rapports
- [ ] Intégration paiement Stripe