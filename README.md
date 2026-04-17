# 🛍️ Encaissly - backend

> La caisse intelligente des boutiques de créateurs

Application mobile de suivi des ventes

![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs) ![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?logo=prisma) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql) ![Node](https://img.shields.io/badge/Node.js-v22-339933?logo=nodedotjs)

API REST de suivi des ventes pour une boutique de créateurs. Permet de gérer les créatrices, d'enregistrer les ventes, de calculer automatiquement les commissions et de contrôler les accès par rôle et par plan d'abonnement.

---

## Stack technique

| Technologie         | Rôle                             |
| ------------------- | -------------------------------- |
| NestJS              | Framework backend                |
| Prisma v7           | ORM                              |
| PostgreSQL (Neon)   | Base de données cloud            |
| class-validator     | Validation des DTOs              |
| class-transformer   | Transformation des types         |
| Jest + Supertest    | Tests unitaires et e2e           |
| Stripe              | Paiements et abonnements         |
| React Native + Expo | Application mobile iOS & Android |

---

## Architecture

```
Requête HTTP
     │
     ▼
 JwtGuard           ← vérifie le token JWT
     │
     ▼
 RolesGuard         ← vérifie le rôle (GERANTE / CREATRICE)
     │
     ▼
 PlanGuard          ← vérifie le plan (FREE / PRO)
     │
     ▼
 Controller         ← reçoit la requête, délègue au service
     │
     ▼
  Service           ← logique métier, calculs de commission
     │
     ▼
PrismaService       ← accès à la base de données
     │
     ▼
 PostgreSQL         ← Neon (cloud)
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
JWT_SECRET="votre-secret-jwt"
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secret"
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

## Sécurité

| Mécanisme       | Rôle                                                     |
| --------------- | -------------------------------------------------------- |
| `JwtGuard`      | Vérifie la présence et la validité du token JWT          |
| `RolesGuard`    | Contrôle l'accès selon le rôle (`GERANTE` / `CREATRICE`) |
| `PlanGuard`     | Contrôle l'accès selon le plan (`FREE` / `PRO`)          |
| `@Roles()`      | Décorateur pour annoter les routes avec les rôles requis |
| `@Plans()`      | Décorateur pour annoter les routes avec les plans requis |
| Helmet          | Headers HTTP sécurisés                                   |
| ThrottlerModule | Rate limiting                                            |
| Joi             | Validation des variables d'environnement                 |

---

## Modules

### Auth `/auth`

Inscription, connexion, déconnexion, refresh tokens et Google OAuth.

| Méthode | Route            | Description                    |
| ------- | ---------------- | ------------------------------ |
| POST    | `/auth/register` | Crée un compte                 |
| POST    | `/auth/login`    | Connexion, retourne les tokens |
| POST    | `/auth/logout`   | Déconnexion, invalide le token |
| POST    | `/auth/refresh`  | Renouvelle l'access token      |
| GET     | `/auth/google`   | Connexion via Google OAuth     |

---

### User `/user`

Profil utilisateur et gestion du plan d'abonnement.

| Méthode | Route           | Description                        |
| ------- | --------------- | ---------------------------------- |
| GET     | `/user/profile` | Récupère le profil connecté        |
| PATCH   | `/user/plan`    | Met à jour le plan (GERANTE seule) |

---

### Boutique `/boutique`

Gestion des boutiques et des créatrices membres.

| Méthode | Route                                   | Description                                   |
| ------- | --------------------------------------- | --------------------------------------------- |
| POST    | `/boutique`                             | Crée une boutique (GERANTE)                   |
| POST    | `/boutique/:id/membre`                  | Ajoute une créatrice à la boutique (GERANTE)  |
| PATCH   | `/boutique/:id/membre/:membreId/status` | Change le statut d'une créatrice (GERANTE)    |
| PATCH   | `/boutique/:id/membre/:membreId/plan`   | Change le plan d'une créatrice (GERANTE)      |
| GET     | `/boutique`                             | Liste les boutiques de la créatrice connectée |

---

### Creatrice `/creatrice`

Gestion des créatrices et de leurs taux de commission.

| Méthode | Route            | Description                 |
| ------- | ---------------- | --------------------------- |
| GET     | `/creatrice`     | Liste toutes les créatrices |
| GET     | `/creatrice/:id` | Récupère une créatrice      |
| POST    | `/creatrice`     | Crée une créatrice          |
| PATCH   | `/creatrice/:id` | Met à jour une créatrice    |
| DELETE  | `/creatrice/:id` | Supprime une créatrice      |

**Filtres disponibles** sur `GET /creatrice` :

- `nom` — recherche par nom exact
- `minCommision` / `maxCommision` — filtre par intervalle de commission

---

### Vente `/vente`

Enregistrement des ventes avec calcul automatique des commissions.

| Méthode | Route        | Description             |
| ------- | ------------ | ----------------------- |
| GET     | `/vente`     | Liste toutes les ventes |
| GET     | `/vente/:id` | Récupère une vente      |
| POST    | `/vente`     | Crée une vente          |
| PATCH   | `/vente/:id` | Met à jour une vente    |
| DELETE  | `/vente/:id` | Supprime une vente      |

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

### Stats `/stats`

Bilan global et par créatrice.

---

### Export `/export` _(en cours)_

Export des données selon le plan d'abonnement.

| Format | FREE                       | PRO          |
| ------ | -------------------------- | ------------ |
| PDF    | ✓ (1/mois, avec filigrane) | ✓ (illimité) |
| Excel  | ✗                          | ✓            |
| CSV    | ✗                          | ✓            |

---

## Gestion des erreurs

| Code HTTP | Description                            |
| --------- | -------------------------------------- |
| 200       | Succès                                 |
| 201       | Ressource créée                        |
| 400       | Données invalides (validation échouée) |
| 401       | Non authentifié ou token invalide      |
| 403       | Accès interdit (rôle ou plan)          |
| 404       | Ressource introuvable                  |
| 409       | Conflit (email déjà utilisé)           |
| 500       | Erreur serveur interne                 |

---

## Modèle de données

```prisma
model User {
  id              String           @id @default(uuid())
  email           String           @unique
  password        String
  plan            Plan             @default(FREE)
  role            Role             @default(CREATRICE)
  lastExportData  DateTime?
  createdAt       DateTime         @default(now())
  refreshToken    String?
  boutiques       Boutique[]
  boutiqueMembers BoutiqueMember[]
}

model Boutique {
  id              String           @id @default(uuid())
  nom             String
  email           String
  telephone       String
  createdAt       DateTime         @default(now())
  gerante         User             @relation(fields: [geranteId], references: [id])
  geranteId       String
  boutiqueMembers BoutiqueMember[]
}

model BoutiqueMember {
  id               String   @id @default(uuid())
  member           User     @relation(fields: [memberId], references: [id])
  memberId         String
  boutique         Boutique @relation(fields: [boutiqueMemberId], references: [id])
  boutiqueMemberId String
  planMember       Plan     @default(FREE)
  createdAt        DateTime @default(now())
  status           Status   @default(INVITE)
}

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

enum Plan {
  FREE
  PRO
}

enum Role {
  CREATRICE
  GERANTE
}

enum Status {
  ACTIVE
  INVITE
  SUSPENDUE
}
```

---

## Plans

| Fonctionnalité                      | Gratuit                   | Pro (9€/mois ou 79€/an)                   |
| ----------------------------------- | ------------------------- | ----------------------------------------- |
| Créatrices                          | 3 max                     | Illimitées                                |
| Boutiques                           | 1                         | Multi-boutiques                           |
| Stats                               | Mois en cours uniquement  | Avancées + historique complet             |
| Export PDF                          | 1 par mois avec filigrane | Illimité, sans filigrane, brandé boutique |
| Export Excel / CSV                  | ✗                         | ✓                                         |
| Période d'export                    | Mois en cours             | Filtrable librement                       |
| Logo boutique dans PDF              | ✗                         | ✓                                         |
| Récap automatique mensuel par email | ✗                         | ✓                                         |
| Support                             | —                         | Prioritaire                               |

---

## Roadmap

**Backend**

- [x] Module `creatrice` — CRUD + filtres + validation
- [x] Module `vente` — CRUD + filtres + calcul commission automatique
- [x] Module `stats` — bilan global et par créatrice
- [x] Module `auth` — inscription, connexion, JWT, Google OAuth, refresh tokens
- [x] Module `user` — profil, gestion du plan (`FREE` / `PRO`), `lastExportDate`
- [x] Sécurité — Helmet, rate limiting, validation des variables d'env
- [x] `RolesGuard` + `@Roles()` — contrôle d'accès par rôle (`GERANTE` / `CREATRICE`)
- [x] `PlanGuard` + `@Plans()` — contrôle d'accès par plan (`FREE` / `PRO`)
- [x] Module `boutique` — modèle Prisma + structure de base (CRUD en cours)
- [ ] Module `boutique` — logique métier complète (invitations, gestion membres)
- [ ] Module `export`
  - [ ] PDF global et par créatrice (avec filigrane si FREE)
  - [ ] Excel global et par créatrice (PRO uniquement)
  - [ ] CSV global et par créatrice (PRO uniquement)
  - [ ] Limitation 1 export/mois pour FREE + mise à jour `lastExportDate`
- [ ] Module `email` — envoi des récaps mensuels (Nodemailer ou Resend)
- [ ] Cron job — récap automatique mensuel par créatrice (PRO uniquement)
- [ ] Module `stripe` — abonnements mensuel/annuel
- [ ] Tests unitaires et e2e — Jest + Supertest

**Mobile**

- [ ] Application React Native + Expo (iOS & Android)
- [ ] Écrans d'authentification (email/mdp + Google)
- [ ] Dashboard des ventes
- [ ] Gestion des créatrices
- [ ] Stats et rapports
- [ ] Intégration paiement Stripe
- [ ] Visualisation des exports (PDF viewer)
