# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev        # Watch mode (recommended for dev)
npm run start:debug      # Debug + watch mode

# Build & Production
npm run build            # Compile to dist/
npm run start:prod       # Run compiled output

# Tests
npm test                 # Run all unit tests
npm run test:watch       # Watch mode
npm run test:cov         # With coverage
npm run test:e2e         # End-to-end tests
jest --testPathPattern=src/vente/vente.service.spec.ts  # Single test file

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier

# Database (Prisma)
npx prisma migrate dev --name <migration_name>   # Create & apply a migration
npx prisma migrate deploy                        # Apply pending migrations (prod)
npx prisma generate                              # Regenerate client after schema change
npx prisma studio                                # Visual DB explorer
```

## Environment variables required

The app refuses to start if any of these are missing (`ConfigModule` validates on boot):
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `PORT` (optional, defaults to 3000)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (used at runtime, not validated at boot)
- `RESEND_API_KEY` (email service)
- `CLOUDINARY_*` (configured via `cloudinary.provider.ts`)

## Architecture

### Application — Encaissly
Commission management SaaS for craft boutiques. Gérant·e·s manage their boutique and créatrices; créatrices track their own sales and commissions.

### Module structure
Each feature follows the standard NestJS pattern: `module → controller → service → DTOs`.

| Module | Responsibility |
|---|---|
| `auth` | Register, login, logout, token refresh, Google OAuth (web + mobile) |
| `user` | User profile, notification preferences |
| `creatrice` | CRUD for créatrices; linked optionally to a User account |
| `vente` | CRUD for sales; triggers email notification on creation |
| `boutique` | Boutique CRUD, member management (invite/activate/suspend) |
| `evenement` | Pop-up event CRUD, linked to a créatrice; ventes can be scoped to an event |
| `stats` | Aggregated stats (CA, commission, net, historique 3 mois) |
| `export` | PDF/CSV/Excel export for créatrices and boutiques |
| `stripe` | Stripe Checkout sessions, subscription cancel, webhook handler |
| `email` | Resend transactional emails + monthly recap cron jobs |
| `cloudinary` | Image upload for vente photos |

### Data model (key relationships)
```
User (1) ──── (N) Boutique         [gerante owns boutiques]
User (1) ──── (N) BoutiqueMember   [member of boutiques]
User (0..1) ── (N) Creatrice       [optional account linkage]
Creatrice (1) ─ (N) Vente
Creatrice (1) ─ (N) Evenement
Boutique (1) ── (N) Vente
Evenement (0..1) ─ (N) Vente
```

Prisma client is generated into `src/generated/` (not `node_modules`). Always run `npx prisma generate` after schema changes.

### Auth flow
- **Access token**: 15 min, contains `{ sub, email, role, plan }`
- **Refresh token**: 7 days, hashed with bcrypt before storage in DB; nulled on logout
- JWT payload is injected into `req.user` by `JwtStrategy`

### Guards & decorators
- `@UseGuards(JwtGuard)` — requires valid JWT
- `@UseGuards(JwtGuard, RolesGuard)` + `@Roles(Role.GERANTE)` — restricts by role
- `@UseGuards(JwtGuard, PlanGuard)` + `@Plans(Plan.PRO)` — restricts by plan
- `Role` and `Plan` enums are imported from `src/generated/enums`

### Plans
- **FREE**: stats filtered to current month only; watermark added to PDF exports
- **PRO**: full history; monthly email recap via cron

### Stripe integration
Stripe webhook is mounted at `/stripe/webhook` with raw body middleware (before `ValidationPipe`) so the signature can be verified. The webhook upgrades/downgrades user `plan` based on `checkout.session.completed` and `customer.subscription.deleted` events.

### Export
PDF files use custom fonts in `src/export/fonts/` (Archivo). Paths are relative to the CWD at runtime — keep fonts in that location.

### Email (cron)
Two `@Cron(EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)` jobs in `EmailService`:
1. Monthly recap per créatrice (PRO users with notifications on)
2. Monthly recap per boutique (gérant·e·s with notifications on)
