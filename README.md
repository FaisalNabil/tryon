# TryOn — Virtual AR Glasses Try-On Widget

TryOn is a SaaS platform that lets eyewear e-commerce shops offer real-time virtual try-on to their customers. Shop owners embed a single `<script>` tag on their website — customers click a button, grant camera access, and instantly see how glasses look on their face using augmented reality.

## How It Works

1. Shop owner registers, uploads frame images, and gets an embed code
2. A `<script data-key="tk_...">` tag is added to the shop's product page
3. A floating "Try On" button appears on the page
4. Customer clicks it — a modal opens with their live camera feed
5. MediaPipe detects 468 facial landmarks in real-time
6. Glasses are overlaid at the correct position, size, and angle at 30fps
7. Customer can switch between frames and see face shape recommendations

## Architecture

Monorepo with four systems:

```
tryon/
├── widget/      Embeddable AR try-on (Vanilla JS, Vite, Shadow DOM)
├── api/         Backend REST API (Express, Prisma, PostgreSQL, Redis)
├── dashboard/   Shop owner UI (Next.js 14, Tailwind CSS)
├── ml/          Face shape classifier & fit scorer (Python, ONNX)
└── infra/       Docker, Nginx, deployment scripts
```

| System | Stack | Port |
|--------|-------|------|
| Widget | Vanilla JS (ES2022), Vite 5, MediaPipe | 5173 |
| API | Express, Prisma 5, PostgreSQL 16, Redis 7 | 3000 |
| Dashboard | Next.js 14 (App Router), Tailwind CSS | 3001 |
| ML | Python 3.10+, TensorFlow/Keras, ONNX | — |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Python 3.10+ (for ML pipeline only)

### 1. Start Infrastructure

```bash
cd infra
docker compose up -d    # PostgreSQL + Redis
```

### 2. Start the API

```bash
cd api
cp .env.example .env    # Edit with your secrets
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev             # http://localhost:3000
```

### 3. Start the Widget Dev Server

```bash
cd widget
cp .env.example .env    # Set VITE_API_URL=http://localhost:3000/v1
npm install
npm run dev             # http://localhost:5173
```

### 4. Start the Dashboard

```bash
cd dashboard
cp .env.example .env.local
npm install
npm run dev             # http://localhost:3001
```

### 5. Test the Widget

Open `widget/test.html` in your browser. Register a shop via the API, paste your API key, and click "Load Widget".

## Widget Embed Code

```html
<script
  src="https://cdn.yourdomain.com/tryon.iife.js"
  data-key="tk_your_api_key_here"
></script>
```

The widget:
- Loads asynchronously (does not block page rendering)
- Isolates all styles via Shadow DOM (no CSS conflicts)
- Lazy-loads the MediaPipe WASM model only when the modal opens
- Batches analytics events and flushes every 10 seconds

## API Endpoints

### Auth
- `POST /v1/auth/register` — Create a shop account (Zod-validated: email, password ≥8 chars, shopName)
- `POST /v1/auth/login` — Get JWT token

### Shop Management (JWT required)
- `GET /v1/shops/me` — Get shop profile
- `PUT /v1/shops/me` — Update shop/widget settings
- `POST /v1/shops/regenerate-key` — Regenerate API key

### Frames (JWT required)
- `GET /v1/frames` — List shop's frames
- `POST /v1/frames/upload` — Upload a frame image (PNG/JPEG/WebP only, max 10MB)
- `PUT /v1/frames/:id` — Update frame details
- `DELETE /v1/frames/:id` — Remove a frame

### Widget (API key required)
- `GET /v1/widget/config?key=tk_...` — Get widget configuration

### Analytics
- `POST /v1/analytics/ingest` — Batch event ingestion (API key, max 100 events)
- `GET /v1/analytics/summary` — Dashboard analytics (JWT)

### ML — Fit Scoring (API key or JWT)
- `POST /v1/ml/fit-score` — Score a single face shape × frame style pair
- `POST /v1/ml/fit-score-batch` — Score multiple frame styles at once

## AR Pipeline

```
Camera Feed (30fps)
    │
    ▼
MediaPipe FaceLandmarker (468 3D landmarks, WASM + GPU)
    │
    ▼
Geometric Transforms
    ├── Temple-to-temple width → frame width
    ├── Nose bridge position → frame center
    └── Eye-line angle (atan2) → frame rotation
    │
    ▼
Canvas 2D Overlay (glasses PNG composited on video frame)
```

## Key Design Decisions

- **Shadow DOM isolation** — Widget UI lives inside a Shadow DOM host so shop CSS cannot leak in or out
- **Multi-tenancy** — Every database query scopes by `shopId` (from JWT or API key)
- **Dual auth** — Dashboard uses JWT Bearer tokens; widget uses API key validation
- **Config caching** — Widget config cached in Redis (5-min TTL), invalidated on shop/frame updates
- **IIFE bundle** — Widget builds to a single self-executing file for CDN delivery
- **Zod validation** — All API inputs validated with Zod schemas (auth, frames, analytics)
- **Face shape fit scoring** — Rule-based fallback + ONNX-ready architecture for ML model scoring

## Pricing

| Plan | Price | Frames | Try-ons/mo |
|------|-------|--------|------------|
| Trial | Free (14 days) | 5 | 100 |
| Starter | $19/mo | 20 | 500 |
| Growth | $39/mo | 100 | 5,000 |
| Pro | $79/mo | Unlimited | Unlimited |

## Environment Variables

See `.env.example` files in each package:
- `api/.env.example` — Database, Redis, JWT, Stripe, R2, email
- `dashboard/.env.example` — API URL, widget CDN URL
- `widget/.env.example` — API URL (defaults to production)

## Testing

The API has a full integration test suite built with [Vitest](https://vitest.dev/):

```bash
cd api
npm test          # Run all 40 tests
npm run test:watch  # Re-run on file changes
```

**Test files** (in `api/tests/`):

| File | Tests | Covers |
|------|-------|--------|
| `auth.test.js` | 11 | Register, login, JWT validation, Zod errors |
| `frames.test.js` | 8 | CRUD, file upload, tenant isolation |
| `widget.test.js` | 5 | Config endpoint, active frame filtering |
| `analytics.test.js` | 8 | Batch ingestion, summary, face ratios |
| `ml.test.js` | 8 | Fit scoring, batch scoring, dual auth |

External services (R2 storage, rembg) are mocked in `tests/setup.js`. Tests run against a real PostgreSQL database and clean up between runs.

## Development Milestones

- [x] Project Scaffold & Monorepo Setup
- [x] API Core (Auth, DB, Shop CRUD, Analytics)
- [x] Widget Core (Face Detection & AR Overlay)
- [x] Dashboard (Shop Owner Interface)
- [x] Billing, Analytics, Storage & Image Processing
- [x] ML Pipeline (Face Shape & Fit Scoring)
- [x] Infrastructure & Production Deployment
- [x] E2E Testing, Polish & Launch

## Tech Stack

**Frontend:** Vanilla JS, Vite 5, MediaPipe Tasks Vision, Canvas 2D, Shadow DOM

**Backend:** Express.js, Prisma 5, PostgreSQL 16, Redis 7, JWT, bcrypt

**Dashboard:** Next.js 14 (App Router), Tailwind CSS, Recharts

**ML:** Python, TensorFlow/Keras, scikit-learn, ONNX Runtime

**Infrastructure:** Docker Compose, Nginx, PM2, Hetzner VPS, Cloudflare R2, Let's Encrypt

**Testing:** Vitest, integration tests with mocked external services

**Payments:** Stripe (Checkout, Webhooks, Customer Portal)

## License

Proprietary. All rights reserved.
