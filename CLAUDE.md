# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TryOn SaaS — a virtual AR glasses try-on widget for eyewear e-commerce. Shop owners embed a `<script>` tag; customers use their camera to see how glasses look on their face in real-time via MediaPipe face landmarks.

## Architecture

Four systems in a monorepo layout:

| System | Stack | Port | Purpose |
|--------|-------|------|---------|
| **Widget** (`widget/`) | Vanilla JS (ES2022), Vite 5 | 5173 | Embeddable AR try-on (Shadow DOM isolated) |
| **API** (`api/`) | Express, Prisma 5, PostgreSQL 16, Redis 7 | 3000 | Backend: auth, CRUD, billing, analytics |
| **Dashboard** (`dashboard/`) | Next.js 14 (App Router), Tailwind, Recharts | 3001 | Shop owner UI for managing frames & stats |
| **ML** (`ml/`) | Python 3.10+, TensorFlow/Keras, scikit-learn, ONNX | — | Face shape classifier & fit scorer training |

### Widget (`widget/src/`)
- `index.js` — Entry point, reads `data-key` from script tag, auto-executes on load
- `bootstrap.js` — Validates API key via `GET /v1/widget/config?key=...`
- `ui.js` — Shadow DOM mounting, modal/button UI, event handlers
- `camera.js` — getUserMedia, 30fps requestAnimationFrame render loop
- `face-detector.js` — MediaPipe FaceLandmarker wrapper (lazy-loaded WASM)
- `overlay.js` — Canvas rendering: landmarks → glasses position via geometric transforms
- `analytics.js` — Batched event tracking to `POST /v1/analytics/ingest`

### API (`api/src/`)
- `server.js` — Express app entry point, exports `prisma` and `redis` instances
- `routes/auth.js` — Register/login handlers (bcrypt + JWT)
- `routes/shops.js` — Shop profile CRUD, API key regeneration, Redis config cache
- `routes/frames.js` — Frame CRUD, image upload (R2 + rembg in Milestone 5)
- `routes/billing.js` — Stripe checkout sessions, webhooks, customer portal
- `routes/analytics.js` — Aggregation queries for dashboard
- `routes/widget.js` — Public widget config endpoint (API-key authenticated)
- `middleware/auth.js` — JWT verification, sets `req.shopId`
- `middleware/apiKey.js` — API key validation for widget endpoints
- `middleware/errorHandler.js` — Global error middleware
- `services/storage.js` — Cloudflare R2 upload/delete
- `services/imageProcess.js` — Background removal via rembg microservice
- `prisma/schema.prisma` — Database schema (Shop, Frame, Subscription, AnalyticsSession, AnalyticsEvent, ModelVersion)

### Dashboard (`dashboard/src/`)
- `app/layout.js` — Root layout with sidebar navigation
- `app/globals.css` — Tailwind imports + custom component classes (`.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`)
- `app/(auth)/login/page.js` — Login form
- `app/(auth)/register/page.js` — Registration form
- `app/dashboard/page.js` — Overview with stats, charts, usage meter
- `app/dashboard/frames/page.js` — Frame upload and management
- `app/dashboard/embed/page.js` — Embed code and API key display
- `app/dashboard/settings/page.js` — Widget customization (colors, position, text)
- `app/dashboard/billing/page.js` — Plan display, Stripe checkout
- `lib/api.js` — API client library (wraps fetch with JWT auth header)

### ML (`ml/`)
- `fit-scorer/train.py` — GradientBoosting fit scorer, exports to ONNX
- `rembg-service/app.py` — Flask microservice for background removal

### Infra (`infra/`)
- `docker-compose.yml` — PostgreSQL 16, Redis 7, rembg service
- `nginx.conf` — Reverse proxy (api. → :3000, app. → :3001)
- `deploy.sh` — Hetzner VPS setup/update script

## Development Commands

### Infrastructure (start first)
```bash
cd infra && docker compose up -d   # PostgreSQL, Redis, rembg service
```

### API
```bash
cd api
cp .env.example .env               # Configure secrets
npm install
npx prisma migrate dev --name init # Create/update DB tables
npx prisma generate                # Generate Prisma client
npm run dev                        # Express on :3000
```

### Dashboard
```bash
cd dashboard
cp .env.example .env.local
npm install
npm run dev     # Next.js on :3001
npm run build   # Production build
```

### Widget
```bash
cd widget
npm install
npm run dev     # Vite dev server on :5173
npm run build   # Bundle to dist/tryon.iife.js (IIFE format for CDN)
```

### ML
```bash
cd ml/fit-scorer
pip install -r requirements.txt
python train.py
```

### Running Tests
```bash
cd api
npm test            # Run all 40 integration tests (vitest)
npm run test:watch  # Watch mode
```

### Manual Testing
Open `widget/test.html` in a browser with an API key from the dashboard.

## Key Patterns

**Multi-tenancy**: Every database query filters by `shopId` (set by auth middleware from JWT or API key). Never query without tenant scoping.

**Dual auth**: Dashboard routes use JWT Bearer tokens (`middleware/auth.js`). Widget public endpoints use API key validation (`middleware/apiKey.js`, `data-key` attribute → query param or `X-API-Key` header).

**Shadow DOM isolation**: Widget UI mounts inside a Shadow DOM host so shop page CSS cannot leak in or out.

**AR rendering pipeline**: MediaPipe FaceLandmarker (468 3D landmarks) → geometric calculations (temple-to-temple width, nose bridge position, eye-line rotation) → Canvas 2D transforms → glasses PNG overlay at 30fps.

**Config caching**: Widget config is cached in Redis with 5-min TTL per API key (`widget:config:{shopId}`). Cache is invalidated on frame/shop updates.

**Stripe webhook flow**: `checkout.session.completed` → update Subscription record → update Shop plan → invalidate Redis cache. Webhook signature verified via `STRIPE_WEBHOOK_SECRET`.

**Import convention**: API route files import `{ prisma, redis }` from `../server.js` and `{ requireAuth }` from `../middleware/auth.js`. All API routes are ES modules using `export default router`.

**Zod validation**: All route inputs are validated with Zod schemas. Validation errors are caught by the global error handler and returned as 400 with `{ error: 'Validation failed', fields: [...] }`.

**Test architecture**: Tests run with `NODE_ENV=test` which skips `app.listen()`. The test setup (`tests/setup.js`) starts the app on a random port, mocks R2/rembg, and cleans the DB between tests. External services are mocked via `vi.mock()` in the setup file.

**Fit scoring**: Rule-based fallback maps face shapes to frame styles (0-100). ONNX-ready: auto-loads ML model when `ml/fit-scorer/model.onnx` exists, falls back to rules otherwise.

## Environment Variables

API requires `api/.env` (see `api/.env.example`):
```
DATABASE_URL, REDIS_URL, JWT_SECRET, PORT, DASHBOARD_URL,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT,
REMBG_URL, RESEND_API_KEY
```

Dashboard requires `dashboard/.env.local` (see `dashboard/.env.example`):
```
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WIDGET_CDN
```

Widget uses `widget/.env` (optional, defaults to production API):
```
VITE_API_URL
```

## Deployment

Production runs on Hetzner CX21 with Nginx reverse proxy, PM2 process manager, and Let's Encrypt SSL.

```bash
cd infra
bash deploy.sh          # Full setup on fresh VPS
bash deploy.sh update   # Pull, rebuild, restart
```

Nginx routes: `api.` subdomain → :3000, `app.` subdomain → :3001. Widget JS served from Cloudflare R2 CDN.

## Milestone Tracker

Development is tracked in 8 milestones (see `docs/PROJECT_PLAN.md`):
1. ✅ Project Scaffold & Git Init
2. ✅ API Core (Auth, DB, Shop CRUD)
3. ✅ Widget Core (Face Detection & AR Overlay)
4. ✅ Dashboard (Shop Owner Interface)
5. ✅ Billing, Analytics, Storage & Image Processing
6. ✅ ML Pipeline (Face Shape & Fit Scoring)
7. ✅ Infrastructure & Production Deployment
8. ✅ E2E Testing, Polish & Launch
