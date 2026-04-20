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
| Cloudinary          | Stockage des photos de ventes    |
| Resend              | Envoi d'emails transactionnels   |
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
- Un compte [Cloudinary](https://cloudinary.com) pour le stockage des photos
- Un compte [Resend](https://resend.com) pour l'envoi d'emails

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
CLOUDINARY_CLOUD_NAME="votre-cloud-name"
CLOUDINARY_API_KEY="votre-api-key"
CLOUDINARY_API_SECRET="votre-api-secret"
RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"
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

npx prisma generate           # Générer le client Prisma (à faire après chaque migrate)
npx prisma migrate dev        # Créer et appliquer une migration
npx prisma migrate deploy     # Appliquer les migrations en production
npx prisma studio             # Interface graphique de la BDD
```

> ⚠️ Toujours lancer `npx prisma generate` après un `npx prisma migrate dev`.

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

> **Important** : Toutes les routes protégées nécessitent un header `Authorization: Bearer <accessToken>`.
> L'`accessToken` est obtenu via `POST /auth/login`.

---

## Documentation des routes

---

### Auth `/auth`

Gère l'inscription, la connexion, la déconnexion et le renouvellement des tokens.
Les routes Auth sont **publiques** — aucun token requis.

---

#### `POST /auth/register` — Créer un compte

Crée un nouvel utilisateur. Le rôle par défaut est `CREATRICE`, le plan par défaut est `FREE`.

**Body :**

```json
{
  "email": "gerante@test.com",
  "password": "Test1234!"
}
```

**Réponse 201 :**

```json
{
  "id": "abffa9c1-2178-4232-8e0a-e88c868dc200",
  "email": "gerante@test.com",
  "plan": "FREE",
  "role": "CREATRICE",
  "lastExportData": null,
  "createdAt": "2026-04-17T14:07:07.540Z"
}
```

> ⚠️ Note le champ `id` dans la réponse — il sera nécessaire pour ajouter un membre à une boutique.
> Le mot de passe n'est jamais retourné dans la réponse.
> Pour passer un user en `GERANTE`, modifie le champ `role` directement dans Neon.

---

#### `POST /auth/login` — Se connecter

Vérifie les credentials et retourne un `accessToken` (15 min) et un `refreshToken` (7 jours).

**Body :**

```json
{
  "email": "gerante@test.com",
  "password": "Test1234!"
}
```

**Réponse 200 :**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> L'`accessToken` contient `id`, `email`, `role` et `plan` de l'utilisateur.
> Utilise l'`accessToken` dans le header `Authorization: Bearer <token>` pour toutes les routes protégées.

---

#### `POST /auth/logout` — Se déconnecter

Invalide le refresh token en base. L'utilisateur devra se reconnecter pour obtenir de nouveaux tokens.

**Header requis :** `Authorization: Bearer <accessToken>`

**Body :** aucun

**Réponse 200 :**

```json
{
  "message": "Déconnexion réussie"
}
```

---

#### `POST /auth/refresh` — Renouveler l'access token

Génère un nouvel `accessToken` à partir du `refreshToken`.

**Body :**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Réponse 200 :**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### `GET /auth/google` — Connexion Google OAuth

Redirige vers la page de connexion Google. Aucun body requis.

---

### User `/user`

Gère le profil, le plan et les préférences de l'utilisateur connecté.
Toutes les routes nécessitent `Authorization: Bearer <accessToken>`.

---

#### `GET /user/profile` — Récupérer son profil

**Header requis :** `Authorization: Bearer <accessToken>`

**Réponse 200 :**

```json
{
  "id": "abffa9c1-2178-4232-8e0a-e88c868dc200",
  "email": "gerante@test.com",
  "plan": "FREE",
  "role": "GERANTE",
  "notificationsEmail": true,
  "lastExportData": null,
  "createdAt": "2026-04-17T14:07:07.540Z"
}
```

---

#### `PATCH /user/plan` — Mettre à jour son plan

Réservé aux `GERANTE`.

**Header requis :** `Authorization: Bearer <accessToken>` (rôle `GERANTE` obligatoire)

**Body :**

```json
{
  "plan": "PRO"
}
```

**Valeurs acceptées :** `FREE`, `PRO`

---

#### `PATCH /user/notifications` — Activer/désactiver les notifications email

Permet à n'importe quel utilisateur connecté d'activer ou désactiver les emails de notification de vente.

**Header requis :** `Authorization: Bearer <accessToken>`

**Body :**

```json
{
  "notificationsEmail": false
}
```

**Réponse 200 :** l'objet `User` mis à jour.

---

### Boutique `/boutique`

Gère les boutiques et leurs membres.
Toutes les routes nécessitent `Authorization: Bearer <accessToken>`.

---

#### `POST /boutique` — Créer une boutique

Réservé aux `GERANTE`. Le `geranteId` est lu automatiquement depuis le token JWT.

**Header requis :** `Authorization: Bearer <accessToken>` (rôle `GERANTE` obligatoire)

**Body :**

```json
{
  "nom": "Ma Boutique",
  "email": "boutique@test.com",
  "telephone": "0612345678"
}
```

> `email` et `telephone` sont optionnels.

**Réponse 201 :**

```json
{
  "id": "3810828a-dc08-4dc6-810f-a104a4731a2d",
  "nom": "Ma Boutique",
  "email": "boutique@test.com",
  "telephone": "0612345678",
  "createdAt": "2026-04-17T14:08:54.172Z",
  "geranteId": "abffa9c1-2178-4232-8e0a-e88c868dc200"
}
```

> ⚠️ Note le champ `id` — c'est l'id de la boutique, nécessaire pour toutes les routes suivantes.

---

#### `POST /boutique/:boutiqueId/member` — Ajouter une créatrice à la boutique

Réservé aux `GERANTE`. Statut par défaut : `INVITE`. Plan par défaut : `FREE`.

**Header requis :** `Authorization: Bearer <accessToken>` (rôle `GERANTE` obligatoire)

**URL :** remplace `:boutiqueId` par l'`id` de la boutique

**Body :**

```json
{
  "memberId": "14f6d596-64aa-400c-8b81-d3002e08d746"
}
```

> `memberId` = l'`id` du compte `User` de la créatrice, retourné lors du `POST /auth/register` ou visible dans Neon.

**Réponse 201 :**

```json
{
  "id": "c595c1a7-e8dc-4ddc-bb6f-590abdf0195f",
  "memberId": "14f6d596-64aa-400c-8b81-d3002e08d746",
  "boutiqueMemberId": "3810828a-dc08-4dc6-810f-a104a4731a2d",
  "planMember": "FREE",
  "createdAt": "2026-04-20T07:16:37.558Z",
  "status": "INVITE"
}
```

---

#### `PATCH /boutique/:boutiqueId/member/:memberId/status` — Changer le statut d'une créatrice

Réservé aux `GERANTE`.

**Header requis :** `Authorization: Bearer <accessToken>` (rôle `GERANTE` obligatoire)

**URL :** remplace `:boutiqueId` et `:memberId` par leurs ids respectifs

**Body :**

```json
{
  "status": "ACTIVE"
}
```

**Valeurs acceptées :** `ACTIVE`, `INVITE`, `SUSPENDUE`

---

#### `PATCH /boutique/:boutiqueId/member/:memberId/plan` — Changer le plan d'une créatrice

Réservé aux `GERANTE`.

**Header requis :** `Authorization: Bearer <accessToken>` (rôle `GERANTE` obligatoire)

**URL :** remplace `:boutiqueId` et `:memberId` par leurs ids respectifs

**Body :**

```json
{
  "plan": "PRO"
}
```

**Valeurs acceptées :** `FREE`, `PRO`

---

#### `GET /boutique` — Lister ses boutiques

Accessible à tous les rôles. Retourne les boutiques dont l'utilisateur connecté est membre.

**Header requis :** `Authorization: Bearer <accessToken>`

**Body :** aucun

**Réponse 200 :**

```json
[
  {
    "id": "3810828a-dc08-4dc6-810f-a104a4731a2d",
    "nom": "Ma Boutique",
    "email": "boutique@test.com",
    "telephone": "0612345678",
    "createdAt": "2026-04-17T14:08:54.172Z",
    "geranteId": "abffa9c1-2178-4232-8e0a-e88c868dc200"
  }
]
```

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

Enregistrement des ventes avec calcul automatique des commissions, upload photo optionnel et notification email à la créatrice.

| Méthode | Route        | Description             |
| ------- | ------------ | ----------------------- |
| GET     | `/vente`     | Liste toutes les ventes |
| GET     | `/vente/:id` | Récupère une vente      |
| POST    | `/vente`     | Crée une vente          |
| PATCH   | `/vente/:id` | Met à jour une vente    |
| DELETE  | `/vente/:id` | Supprime une vente      |

**Filtres disponibles** sur `GET /vente` :

- `nomArticle` — recherche par nom d'article
- `minPrixVente` / `maxPrixVente` — filtre par intervalle de prix
- `modePaiement` — `ESPECES` ou `CARTE`

---

#### `POST /vente` — Créer une vente

> ⚠️ Cette route utilise `form-data` (pas `raw JSON`) car elle accepte un fichier photo.

**Header requis :** `Authorization: Bearer <accessToken>`

**Body (form-data) :**

| Clé          | Type | Obligatoire | Description                      |
| ------------ | ---- | ----------- | -------------------------------- |
| nomArticle   | Text | ✓           | Nom de l'article vendu           |
| prixVente    | Text | ✓           | Prix de vente (nombre)           |
| modePaiement | Text | ✓           | `ESPECES` ou `CARTE`             |
| creatriceId  | Text | ✓           | UUID de la créatrice             |
| boutiqueId   | Text | ✗           | UUID de la boutique (optionnel)  |
| photo        | File | ✗           | Photo de l'article (optionnelle) |

**Réponse 201 :**

```json
{
  "id": "ac4eb9d4-2c81-4e27-9a81-54d587e667a5",
  "photo": "https://res.cloudinary.com/xxx/image/upload/v1/encaissly/ventes/xxx.webp",
  "nomArticle": "Boucle oreille",
  "prixVente": 25,
  "modePaiement": "CARTE",
  "boutiqueId": "3810828a-dc08-4dc6-810f-a104a4731a2d",
  "createdAt": "2026-04-20T08:26:25.191Z",
  "creatriceId": "e158e704-1788-4c56-87d3-51671c128fe9",
  "creatrice": { "nom": "Marie", "tauxDeCommission": 30 },
  "montantCommission": 7.5,
  "netCreatrice": 17.5
}
```

> La photo est uploadée sur Cloudinary et seule l'URL est stockée en base.
> Si la créatrice a un compte `User` lié avec `notificationsEmail: true`, un email de notification lui est envoyé automatiquement.

---

### Stats `/stats`

Bilan global et par créatrice.

---

### Export `/export`

Export des données selon le plan d'abonnement.

| Format | FREE               | PRO          |
| ------ | ------------------ | ------------ |
| PDF    | ✓ (avec filigrane) | ✓ (illimité) |
| Excel  | ✗                  | ✓            |
| CSV    | ✗                  | ✓            |

---

#### Routes export créatrice

| Méthode | Route           | Description                              | Accès |
| ------- | --------------- | ---------------------------------------- | ----- |
| GET     | `/export/pdf`   | PDF des ventes de la créatrice connectée | Tous  |
| GET     | `/export/excel` | Excel des ventes                         | PRO   |
| GET     | `/export/csv`   | CSV des ventes                           | PRO   |

---

#### Routes export boutique

| Méthode | Route                    | Description                | Accès         |
| ------- | ------------------------ | -------------------------- | ------------- |
| GET     | `/export/pdf/boutique`   | PDF résumé par créatrice   | GERANTE       |
| GET     | `/export/excel/boutique` | Excel résumé par créatrice | GERANTE + PRO |
| GET     | `/export/csv/boutique`   | CSV résumé par créatrice   | GERANTE + PRO |

> Les routes boutique nécessitent un query param `?boutiqueId=<id>`.
> Exemple : `GET /export/pdf/boutique?boutiqueId=3810828a-dc08-4dc6-810f-a104a4731a2d`

---

### Email `/email`

Gestion des notifications email via Resend.

- **Notification de vente** — envoyée automatiquement à la créatrice lors de la création d'une vente si `notificationsEmail: true`
- **Activation/désactivation** — via `PATCH /user/notifications`

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
  id                  String           @id @default(uuid())
  email               String           @unique
  password            String
  plan                Plan             @default(FREE)
  role                Role             @default(CREATRICE)
  notificationsEmail  Boolean          @default(true)
  lastExportData      DateTime?
  createdAt           DateTime         @default(now())
  refreshToken        String?
  boutiques           Boutique[]
  boutiqueMembers     BoutiqueMember[]
  creatrices          Creatrice[]
}

model Boutique {
  id              String           @id @default(uuid())
  nom             String
  email           String?
  telephone       String?
  createdAt       DateTime         @default(now())
  gerante         User             @relation(fields: [geranteId], references: [id])
  geranteId       String
  boutiqueMembers BoutiqueMember[]
  ventes          Vente[]
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
  @@unique([memberId, boutiqueMemberId])
}

model Creatrice {
  id               String   @id @default(uuid())
  nom              String
  email            String?
  telephone        String?
  tauxDeCommission Float
  createdAt        DateTime @default(now())
  vente            Vente[]
  user             User?    @relation(fields: [userId], references: [id])
  userId           String?
}

model Vente {
  id           String       @id @default(uuid())
  photo        String?
  nomArticle   String
  prixVente    Float
  modePaiement ModePaiement
  createdAt    DateTime     @default(now())
  creatrice    Creatrice    @relation(fields: [creatriceId], references: [id])
  creatriceId  String
  boutique     Boutique?    @relation(fields: [boutiqueId], references: [id])
  boutiqueId   String?
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
- [x] Module `vente` — CRUD + filtres + calcul commission + upload photo (Cloudinary)
- [x] Module `stats` — bilan global et par créatrice
- [x] Module `auth` — inscription, connexion, JWT, Google OAuth, refresh tokens
- [x] Module `user` — profil, gestion du plan (`FREE` / `PRO`), notifications email
- [x] Sécurité — Helmet, rate limiting, validation des variables d'env
- [x] `RolesGuard` + `@Roles()` — contrôle d'accès par rôle (`GERANTE` / `CREATRICE`)
- [x] `PlanGuard` + `@Plans()` — contrôle d'accès par plan (`FREE` / `PRO`)
- [x] Module `boutique` — CRUD complet + gestion des membres (statut, plan)
- [x] Module `cloudinary` — upload et stockage des photos de ventes
- [x] Module `export` — PDF, Excel, CSV par créatrice et par boutique (avec filigrane FREE)
- [x] Module `email` — notification email à la créatrice lors d'une vente (Resend)
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
