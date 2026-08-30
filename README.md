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
| Stripe              | Paiements et abonnements         |
| class-validator     | Validation des DTOs              |
| class-transformer   | Transformation des types         |
| Jest + Supertest    | Tests unitaires et e2e           |
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
- Un compte [Stripe](https://stripe.com) pour les paiements

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
# ============================================================
# BASE DE DONNÉES
# ============================================================
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=verify-full"

# ============================================================
# AUTHENTIFICATION JWT
# ============================================================
JWT_SECRET="votre-secret-jwt"

# ============================================================
# GOOGLE OAUTH
# ============================================================
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# ============================================================
# CLOUDINARY — Stockage des photos
# ============================================================
CLOUDINARY_CLOUD_NAME="votre-cloud-name"
CLOUDINARY_API_KEY="votre-api-key"
CLOUDINARY_API_SECRET="votre-api-secret"

# ============================================================
# RESEND — Envoi d'emails
# ============================================================
RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"

# ============================================================
# STRIPE — Paiements et abonnements
# ============================================================
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxx"
STRIPE_PRICE_MENSUEL="price_xxxxxxxxxxxxxxxx"
STRIPE_PRICE_ANNUEL="price_xxxxxxxxxxxxxxxx"
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

Invalide le refresh token en base.

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

#### `GET /auth/google` — Connexion Google OAuth (web)

Redirige vers la page de connexion Google. Aucun body requis. Utilisé par un éventuel client web — l'app mobile utilise `/auth/google/mobile` ci-dessous.

---

#### `POST /auth/google/mobile` — Connexion/inscription Google (mobile)

Le mobile utilise `@react-native-google-signin/google-signin` (natif, Credential Manager — pas de navigateur ni de redirection). Le serveur vérifie l'`idToken` via `verifyIdToken()` (audience = client Web/Android/iOS), sans appel réseau supplémentaire.

**Body :**

```json
{
  "idToken": "eyJhbGciOi...",
  "role": "GERANTE",
  "acceptedCGU": true
}
```

- `idToken` — obligatoire
- `role` / `acceptedCGU` — fournis **uniquement** pour finaliser une inscription (après le formulaire pré-rempli côté app). Absents pour un simple login.
- Si aucun compte n'existe pour cet email et qu'`acceptedCGU` n'est pas `true` → `401`, aucun compte n'est créé silencieusement (l'app redirige alors vers l'inscription).

---

### User `/user`

Gère le profil, le plan et les préférences de l'utilisateur connecté.
Toutes les routes nécessitent `Authorization: Bearer <accessToken>`.

---

#### `GET /user/profile` — Récupérer son profil

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

> ⚠️ `PATCH /user/plan` n'existe plus (retiré volontairement) — le `plan` est géré **exclusivement** par le webhook Stripe (`checkout.session.completed` / `customer.subscription.deleted`). Le laisser modifiable par le client aurait permis à n'importe qui de s'auto-upgrader sans payer.

#### `PATCH /user/profile` — Modifier nom/prénom

**Body :** `{ "nom"?: string, "prenom"?: string }`

---

#### `POST /user/avatar` — Upload avatar (multipart, champ `file`)

Upload vers Cloudinary (`encaissly/avatars`), retourne le profil avec la nouvelle URL `avatar`.

---

#### `PATCH /user/upgrade-duo` — Passer le rôle en `GERANTE_CREATRICE`

Idempotent. Crée aussi la fiche `Creatrice` auto-gérée (`geranteId = userId = userId`) si elle n'existe pas encore. Ne change pas le `plan` — l'upgrade payant vers `DUO` se fait ensuite via `/stripe/checkout`.

---

#### `PATCH /user/notifications` — Activer/désactiver les notifications email

**Body :**

```json
{
  "notificationsEmail": false
}
```

---

#### `DELETE /user/account` — Supprimer son compte (droit à l'effacement RGPD)

**Anonymise** le compte (email → `deleted-{id}@encaissly.invalid`, mot de passe invalidé, nom/prénom/avatar/tokens/`stripeCustomerId` effacés, `deletedAt` posé) plutôt que de supprimer la ligne — les boutiques/créatrices/ventes liées restent intactes et résolubles (obligation légale française de conservation des données comptables, 10 ans). Résilie l'abonnement Stripe actif au passage (best-effort). Détache (sans supprimer) toute fiche `Creatrice` liée au compte.

---

### Boutique `/boutique`

Gère les boutiques et leurs membres.
Toutes les routes nécessitent `Authorization: Bearer <accessToken>`.

---

#### `POST /boutique` — Créer une boutique

Réservé aux `GERANTE`. Le `geranteId` est lu automatiquement depuis le token JWT.

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

---

#### `POST /boutique/:boutiqueId/member` — Ajouter une créatrice

Réservé aux `GERANTE`. Statut par défaut : `INVITE`. Plan par défaut : `FREE`.

**Body :**

```json
{
  "memberId": "14f6d596-64aa-400c-8b81-d3002e08d746"
}
```

> `memberId` = l'`id` du compte `User` de la créatrice.

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

#### `PATCH /boutique/:boutiqueId/member/:memberId/status` — Changer le statut

Réservé aux `GERANTE`.

**Body :**

```json
{
  "status": "ACTIVE"
}
```

**Valeurs acceptées :** `ACTIVE`, `INVITE`, `SUSPENDUE`

---

#### `PATCH /boutique/:boutiqueId/member/:memberId/plan` — Changer le plan

Réservé aux `GERANTE`.

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
- `evenementId` — ventes d'un événement (créatrice, priment sur `boutiqueId`)
- `boutiqueId` — ventes d'une boutique. Résolu par la **relation réelle** avec cette boutique précise (gérante propriétaire, ou créatrice membre via `BoutiqueMember`), jamais par le rôle stocké seul — un compte `GERANTE_CREATRICE` peut être gérante d'une boutique et simple membre d'une autre ; une créatrice membre ne voit jamais que ses propres ventes dans cette boutique

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
| boutiqueId   | Text | ✗           | UUID de la boutique (auto-détectée si omise, pour une GERANTE) |
| evenementId  | Text | ✗           | UUID de l'événement (créatrice)  |
| sansCommission | Text | ✗         | `true` pour forcer la commission de CETTE vente à 0%, quel que soit le mode de paiement |
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

#### Routes export créatrice

| Méthode | Route           | Description                              | Accès |
| ------- | --------------- | ---------------------------------------- | ----- |
| GET     | `/export/pdf`   | PDF des ventes de la créatrice connectée | Tous  |
| GET     | `/export/excel` | Excel des ventes                         | PRO   |
| GET     | `/export/csv`   | CSV des ventes                           | PRO   |

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

- **Notification de vente** — envoyée automatiquement lors de la création d'une vente si `notificationsEmail: true`
- **Récap mensuel créatrice** — envoyé automatiquement le 1er de chaque mois aux créatrices PRO
- **Récap mensuel boutique** — envoyé automatiquement le 1er de chaque mois aux gérantes avec notifications activées
- **Activation/désactivation** — via `PATCH /user/notifications`

---

### Stripe `/stripe`

Gestion des abonnements PRO via Stripe.

| Méthode | Route              | Description                           | Accès    |
| ------- | ------------------ | ------------------------------------- | -------- |
| POST    | `/stripe/checkout` | Crée une session de paiement Stripe   | Connecté |
| POST    | `/stripe/cancel`   | Annule l'abonnement actif             | Connecté |
| POST    | `/stripe/webhook`  | Reçoit les événements Stripe (public) | Public   |

#### `POST /stripe/checkout` — Créer une session de paiement

**Header requis :** `Authorization: Bearer <accessToken>`

**Body :**

```json
{
  "priceId": "price_xxxxxxxxxxxxxxxx"
}
```

**Réponse 200 :**

```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

> Redirige l'utilisateur vers cette URL pour effectuer le paiement.
> Après paiement réussi, Stripe envoie un webhook `checkout.session.completed` qui passe automatiquement le plan en `PRO`.

#### `POST /stripe/cancel` — Annuler l'abonnement

**Header requis :** `Authorization: Bearer <accessToken>`

**Réponse 200 :**

```json
{
  "message": "Abonnement annulé avec succès"
}
```

> Stripe envoie un webhook `customer.subscription.deleted` qui repasse automatiquement le plan en `FREE`.

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

> Schéma source de vérité : [`prisma/schema.prisma`](./prisma/schema.prisma). Résumé ci-dessous — se référer au fichier pour le détail exact (types, index, `onDelete`).

```prisma
model User {
  id, email (unique), nom?, prenom?, password
  plan (FREE|PRO|DUO), role (CREATRICE|GERANTE|GERANTE_CREATRICE)
  notificationsEmail, stripeCustomerId?, avatar?, lastExportData?, refreshToken?
  cguAcceptedAt?          // preuve de consentement, posé à l'inscription (email ou Google)
  deletedAt?              // non-null = compte anonymisé (RGPD), ligne conservée pour les FK
  boutiques[], boutiqueMembers[], notifications[]
  creatrices[]        @relation("CreatriceCompte")   // sa PROPRE fiche créatrice si elle en a une (DUO)
  creatricesGerees[]  @relation("CreatriceGerante")  // les créatrices qu'elle gère (GERANTE)
}

model Boutique {
  id, nom, email?, telephone?, createdAt
  gerante User @relation(geranteId)   // propriétaire — toujours un seul
  boutiqueMembers[], ventes[]
}

model BoutiqueMember {
  member User (memberId), boutiqueMember Boutique (boutiqueMemberId)
  planMember (FREE|PRO|DUO), status (ACTIVE|INVITE|SUSPENDUE)
  @@unique([memberId, boutiqueMemberId])
}

model Creatrice {
  id, nom, email?, telephone?, tauxDeCommission, createdAt
  user User? (userId, @unique)     // compte lié — null si fiche créée sans invitation acceptée
  gerante User (geranteId)         // qui la gère — toujours renseigné, y compris auto-géré en DUO
  vente[], evenements[], articles[]
}

model Evenement {
  id, nom, dateDebut, dateFin?
  creatrice Creatrice (creatriceId)   // événement personnel, indépendant d'une boutique
  ventes[], articles[]
}

model Article {
  id, nom, description?, prixIndicatif?, quantite?, photo?
  creatrice? (onDelete: Cascade), evenement? (onDelete: Cascade)   // l'un des deux toujours présent
  @@unique([nom, creatriceId]) / @@unique([nom, evenementId])
}

model Vente {
  id, photo?, nomArticle, prixVente, quantite, modePaiement (ESPECES|CARTE)
  sansCommission (Boolean, défaut false)   // force la commission de CETTE vente à 0%
  creatrice Creatrice (creatriceId, obligatoire)
  boutique? Boutique (boutiqueId), evenement? Evenement (evenementId)
}

model Notification {
  id, userId (onDelete: Cascade), type, message, metadata (Json)?, read
}

enum Plan { FREE, PRO, DUO }
enum Role { CREATRICE, GERANTE, GERANTE_CREATRICE }
enum Status { ACTIVE, INVITE, SUSPENDUE }
enum ModePaiement { ESPECES, CARTE }
```

Le calcul de commission (`prixVente × tauxDeCommission / 100`, ou `0` si `sansCommission`) est centralisé dans [`src/common/commission.util.ts`](./src/common/commission.util.ts) — utilisé partout où un montant de commission est calculé (vente, stats, créatrice, export, email), pour ne jamais avoir à dupliquer/resynchroniser la formule.

---

## Rôles

| Rôle                | Description                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `GERANTE`            | Gère boutique(s), créatrices, ventes, stats globales                     |
| `CREATRICE`          | Voit ses propres ventes/commissions, peut être membre de boutiques d'autres gérantes |
| `GERANTE_CREATRICE`  | "DUO" — cumule les deux rôles sur un seul compte. Le choix d'affichage gérante/créatrice (`duoMode`) est un état **côté client uniquement** (jamais transmis au serveur) — toute logique métier qui doit distinguer les deux casquettes d'un compte DUO doit vérifier la relation réelle en base (ex. `geranteId` de la boutique demandée) et jamais se fier au rôle stocké seul |

## Plans

| Fonctionnalité                      | Gratuit                   | Pro (9€/mois ou 79€/an) / DUO (15€/mois ou 129€/an) |
| ----------------------------------- | ------------------------- | ------------------------------------------------------ |
| Créatrices                          | 3 max                     | Illimitées                                              |
| Boutiques                           | 1                         | Multi-boutiques                                         |
| Événements (créatrice)              | 1 max                     | Illimités                                               |
| Stats                               | Mois en cours uniquement  | Avancées + historique complet (3 mois)                  |
| Export PDF                          | 1 par mois avec filigrane | Illimité, sans filigrane, brandé boutique               |
| Export Excel / CSV                  | ✗                         | ✓                                                        |
| Récap automatique mensuel par email | ✗                         | ✓                                                        |

> `DUO` (`Plan.DUO`) débloque **exactement** les mêmes fonctionnalités que `PRO` — c'est un plan payant à part entière (pour les comptes `GERANTE_CREATRICE`), pas une variante de `FREE`. Toute vérification de plan doit traiter `PRO` et `DUO` de façon identique (jamais `plan === 'PRO'` seul comme condition de déblocage — historiquement une source de bugs où DUO se retrouvait bridé comme `FREE`).

---

## Roadmap

**Backend**

- [x] Module `creatrice` — CRUD + filtres + validation + invitation par email/notification
- [x] Module `vente` — CRUD + filtres (dont `boutiqueId` résolu par relation réelle, pas par rôle) + calcul commission centralisé (`common/commission.util.ts`) + override `sansCommission` par vente + upload photo (Cloudinary)
- [x] Module `stats` — bilan global, par créatrice, historique, top articles
- [x] Module `auth` — inscription, connexion, JWT, Google OAuth (web + natif mobile via idToken), refresh tokens, CGU obligatoires côté serveur
- [x] Module `user` — profil, avatar, upgrade DUO, notifications email, **suppression de compte (anonymisation RGPD)**
- [x] Sécurité — Helmet, rate limiting, validation des variables d'env, plan géré uniquement par webhook Stripe (pas d'endpoint client)
- [x] `RolesGuard` + `@Roles()` — contrôle d'accès par rôle (`GERANTE` / `CREATRICE` / `GERANTE_CREATRICE`)
- [x] `PlanGuard` + `@Plans()` — contrôle d'accès par plan (`FREE` / `PRO` / `DUO`)
- [x] Module `boutique` — CRUD complet + gestion des membres (statut, plan)
- [x] Module `evenement` — événements personnels créatrice (marché, foire), indépendants d'une boutique
- [x] Module `cloudinary` — upload et stockage des photos de ventes/avatars
- [x] Module `export` — PDF, Excel, CSV par créatrice et par boutique (avec filigrane FREE)
- [x] Module `email` — notifications vente + récaps mensuels automatiques PRO/DUO (Resend)
- [x] Module `notification` — notifications in-app (invitations, ventes)
- [x] Cron jobs — récap mensuel créatrice + récap mensuel boutique
- [x] Module `stripe` — abonnements PRO/DUO mensuel/annuel + webhooks
- [ ] Tests unitaires et e2e — Jest + Supertest
- [ ] Séparation base de données dev/prod (actuellement même instance Neon)
- [ ] Retention légale des données comptables au-delà de la simple anonymisation compte (10 ans, Code de commerce) — à formaliser avant les premiers vrais clients payants

**Mobile** (`encaissly-mobile`, Expo + Expo Router)

- [x] Application React Native + Expo (Android testé, iOS non encore buildé/testé)
- [x] Écrans d'authentification — email/mdp + Google natif (Credential Manager), flow d'inscription à choix Google/Email
- [x] Dashboard, Ventes (création/édition/suppression), Créatrices, Stats, Profil
- [x] Gestion des créatrices — fiches directes ou invitations
- [x] Mode DUO (`GERANTE_CREATRICE`) avec bascule d'affichage gérante/créatrice
- [x] Onglet "Boutique" pour une créatrice affiliée — ses ventes filtrées par boutique
- [x] Intégration paiement Stripe (checkout + résiliation)
- [x] Export PDF/Excel/CSV (téléchargement + partage natif)
- [x] Notifications in-app + badge
- [x] Écran Aide (guide par section/rôle)
- [x] Suppression de compte
- [ ] Build iOS (actuellement Android uniquement, test fermé)
- [ ] Dark mode
- [ ] Mise en production réelle (Play Store, Stripe live, domaine email) — bloquée par la réimmatriculation SIRET de l'auto-entreprise
