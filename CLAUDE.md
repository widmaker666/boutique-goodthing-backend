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
npm run format           # Prettier (singleQuote, trailingComma: all)

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
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY` (email service)
- `RESEND_OVERRIDE_EMAIL` (optional — redirects all outgoing emails to this address, for dev/sandbox)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `APP_URL` — used for Stripe checkout success/cancel redirect URLs
- `CORS_ORIGINS` (optional — comma-separated list of allowed origins; falls back to `*` if unset)

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
| `vente` | CRUD for sales; auto-detects boutique, decrements article stock, triggers email notifications, calculates commission |
| `boutique` | Boutique CRUD, member management (invite/activate/suspend) |
| `evenement` | Pop-up event CRUD, linked to a créatrice; ventes can be scoped to an event |
| `article` | Catalogue of items per créatrice (stock, prix indicatif, photo); bulk import via ExcelJS |
| `stats` | Aggregated stats (CA, commission, net, historique 3 mois) |
| `export` | PDF/CSV/Excel export for créatrices and boutiques |
| `stripe` | Stripe Checkout sessions, subscription cancel, webhook handler |
| `email` | Resend transactional emails + monthly recap cron jobs |
| `cloudinary` | Image upload for vente/article photos |

### Data model (key relationships)
```
User (1) ──── (N) Boutique         [gerante owns boutiques]
User (1) ──── (N) BoutiqueMember   [member of boutiques]
User (0..1) ── (N) Creatrice       [optional account linkage]
Creatrice (1) ─ (N) Vente
Creatrice (1) ─ (N) Evenement
Creatrice (1) ─ (N) Article        [onDelete: Cascade, @@unique([nom, creatriceId])]
Boutique (1) ── (N) Vente
Evenement (0..1) ─ (N) Vente
```

Prisma client is generated into `src/generated/` (not `node_modules`). Always run `npx prisma generate` after schema changes. Migration folders use `YYYYMMDDHHMMSS_description` naming.

### DTO / validation conventions
- `class-validator` decorators with French custom messages, e.g. `@MinLength(n, { message: 'Le xyz est trop court' })`
- `UpdateXxxDto extends PartialType(CreateXxxDto)` from `@nestjs/mapped-types` — only provided fields are updated
- Query DTOs use `@Type(() => Number)` (class-transformer) for numeric query params, paired with global `ValidationPipe({ transform: true })`
- Phone fields use `@IsPhoneNumber('FR')`
- Enums (`ModePaiement`, `Plan`, `Role`, `Status`) imported from `src/generated/enums`

### Auth flow
- **Access token**: 15 min, contains `{ sub, email, role, plan }`
- **Refresh token**: 7 days, hashed with bcrypt before storage in DB; nulled on logout
- JWT payload is injected into `req.user` by `JwtStrategy`

### Guards & decorators
- `@UseGuards(JwtGuard)` — extends `AuthGuard('jwt')`, delegates to Passport
- `@UseGuards(JwtGuard, RolesGuard)` + `@Roles(Role.GERANTE)` — restricts by role (decorator file: `role.decorateur.ts`, French spelling)
- `@UseGuards(JwtGuard, PlanGuard)` + `@Plans(Plan.PRO)` — restricts by plan (`plan.decorateur.ts`)
- Both `RolesGuard`/`PlanGuard` use `Reflector.get('roles'|'plans', context.getHandler())` and return `true` if no metadata is set (no restriction by default), but `false` if `req.user` is missing
- `Role` and `Plan` enums are imported from `src/generated/enums`

### Rate limiting & security headers
- `ThrottlerGuard` registered globally via `APP_GUARD` (base config in `app.module.ts`)
- Stricter `@Throttle(...)` on `auth` routes: register/login/google-mobile (5/60s), refresh (10/60s)
- `helmet()` applied first in `main.ts`, before CORS and the Stripe raw-body middleware
- CORS origins from `CORS_ORIGINS` env (comma-separated), falls back to `*` if unset

### Plans
- **FREE**: stats filtered to current month only; watermark "MODE GRATUIT" added to PDF exports; gérante limited to 1 boutique (auto-detected in vente creation)
- **PRO**: full history; monthly email recap via cron

### Vente creation flow (`vente.service.ts: create`)
1. Validates `creatriceId` exists
2. Auto-detects `boutiqueId` from `geranteId` if not provided (FREE plan = 1 boutique)
3. If `articleId` provided: decrements `Article.quantite` via `updateMany` guarded by `quantite: { gte: requested }` (prevents negative stock)
4. Computes `montantCommission`/`netCreatrice` from `creatrice.tauxDeCommission`, rounded to 2 decimals
5. Sends email notification to **two recipients** if notifications enabled: the créatrice's linked User, and the boutique's gérante

### Stripe integration
Stripe webhook is mounted at `/stripe/webhook` with raw body middleware **before** `ValidationPipe` (in `main.ts`) so the signature can be verified. The webhook upgrades/downgrades user `plan` based on `checkout.session.completed` and `customer.subscription.deleted` events.

### Cloudinary
`CloudinaryService.uploadImage` wraps `cloudinary.uploader.upload_stream` (folder `encaissly/ventes`) in a Promise, accepting `Express.Multer.File.buffer`. Controllers use `@UseInterceptors(FileInterceptor('photo'))`.

### Export
PDF files use custom fonts in `src/export/fonts/` (Archivo Regular/Bold). Paths are relative to the CWD at runtime — keep fonts in that location. Color scheme: PRIMARY `#451e64`, ACCENT `#eb7f45`. FREE plan PDFs get a "MODE GRATUIT" watermark overlay.

### Email (cron)
Two `@Cron(EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)` jobs in `EmailService`, both covering the **previous** month:
1. Monthly recap per créatrice (PRO users with notifications on)
2. Monthly recap per boutique (gérant·e·s with notifications on)

### Tests
- Mocks live in `src/**/mocksTest/` (e.g. `mockCreatriceService.ts`) — export a `mockPrismaService` with `jest.fn()` per Prisma model method, plus fixture objects
- Standard setup: `Test.createTestingModule({ providers: [Service, { provide: PrismaService, useValue: mockPrismaService }] })`
- Most `.spec.ts` files are minimal (`toBeDefined()` checks)

### TS config quirks
`noImplicitAny: false`, `strictBindCallApply: false`, `noFallthroughCasesInSwitch: false`, `emitDecoratorMetadata: true` (required for NestJS DI/decorators).
