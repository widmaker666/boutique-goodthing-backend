# 🛍️ Boutique Backend

API REST de suivi des ventes pour une boutique de créateurs. Permet de gérer les créatrices, d'enregistrer les ventes et de calculer automatiquement les commissions.

## Stack technique

- **Framework** : NestJS
- **ORM** : Prisma v7
- **Base de données** : PostgreSQL (Neon)
- **Validation** : class-validator / class-transformer
- **Runtime** : Node.js

## Prérequis

- Node.js v18+
- Un compte [Neon](https://neon.tech) pour la base de données

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

## Variables d'environnement

```env
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=verify-full"
```

## Modules

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

## Roadmap

- [ ] Module Stats — bilan global et par créatrice
- [ ] Application mobile React Native + Expo
- [ ] Export PDF / Excel des récapitulatifs
- [ ] Authentification
