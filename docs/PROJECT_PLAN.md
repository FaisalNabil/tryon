# TryOn SaaS — Master Project Plan
> Virtual glasses try-on widget for eyewear e-commerce shops  
> Last updated: 2026-03-10  
> Status legend: ⬜ Not started | 🟡 In progress | ✅ Done | ❌ Blocked

---

## ✅ Code Written (48 files across 4 systems)

| System | Files written | Status |
|---|---|---|
| Widget | `index.js` `bootstrap.js` `ui.js` `camera.js` `face-detector.js` `overlay.js` `analytics.js` + `vite.config.js` `package.json` `test.html` | Code written — **needs npm install + browser test** |
| API | `server.js` + routes: `auth` `shops` `frames` `widget` `analytics` `billing` + middleware: `auth` `apiKey` `errorHandler` + services: `storage` `imageProcess` + `schema.prisma` | Code written — **needs npm install + .env + DB migrate** |
| Dashboard | `layout.js` `page.js` (overview, frames, embed, settings, billing) `login` `register` `api.js` `globals.css` | Code written — **needs npm install + .env.local** |
| ML | `rembg-service/app.py` `face-shape-classifier/train.py` `fit-scorer/train.py` | Code written — **needs pip install + training data** |
| Infra | `docker-compose.yml` `nginx.conf` `deploy.sh` | Written — **needs domain names substituted** |

## ⬜ Still Needs To Be Done (genuine work remaining)

| Task | Where | Effort |
|---|---|---|
| `npm install` + first run for all 3 JS systems | widget / api / dashboard | 30 min |
| Edit `.env` with real secrets (DB, Stripe, R2, JWT) | `api/.env` | 30 min |
| Run `npx prisma migrate dev` to create DB tables | `api/` | 5 min |
| `npm run build` widget → upload `dist/tryon.iife.js` to Cloudflare R2 | `widget/` | 1 hr |
| Create Stripe products + copy price IDs to `.env` | Stripe dashboard | 30 min |
| Create Cloudflare R2 bucket + copy credentials to `.env` | Cloudflare dashboard | 30 min |
| Register domain, point DNS to Hetzner VPS | Domain registrar | 1 hr |
| Run `deploy.sh` on fresh Hetzner VPS | VPS terminal | 1-2 hrs |
| Run `certbot` for HTTPS | VPS terminal | 15 min |
| Set Stripe webhook URL in Stripe dashboard | Stripe dashboard | 10 min |
| Collect ~300 labeled face shape images per class for ML | Manual/Upwork | 1-2 days |
| Train face shape classifier (`python train.py`) | `ml/face-shape-classifier/` | 2-4 hrs (GPU) |
| Wire face shape API call from widget to server | `api/src/routes/widget.js` | 2 hrs |
| `next.config.js` for dashboard (Tailwind postcss setup) | `dashboard/` | 30 min |
| Add `tailwind.config.js` + `postcss.config.js` | `dashboard/` | 15 min |
| Landing page (marketing, not dashboard) | New page | 1 day |
| Welcome email on register (Resend) | `api/src/services/email.js` | 2 hrs |
| End-to-end test: register → upload → embed → try on | Manual QA | 2 hrs |

---

## 🗺️ System Overview

```
4 systems to build:
1. Widget          — the JS embed that runs on shop owner's website
2. API             — Node.js backend powering everything
3. Dashboard       — Next.js web app for shop owners
4. ML Pipeline     — AI models for face shape + fit scoring
```

---

## 📁 Folder Structure

```
tryon-saas/
├── docs/                        ← All planning docs (you are here)
│   ├── PROJECT_PLAN.md          ← Master tracker
│   ├── ARCHITECTURE.md          ← Technical architecture deep dive
│   ├── API_SPEC.md              ← All API endpoints documented
│   └── DECISIONS.md             ← Why we made certain tech choices
│
├── widget/                      ← The embeddable JS widget
│   ├── src/
│   │   ├── index.js             ← Entry point, bootstraps widget
│   │   ├── bootstrap.js         ← Validates API key, fetches config
│   │   ├── ui.js                ← Floating button + modal DOM
│   │   ├── camera.js            ← getUserMedia, video stream
│   │   ├── face-detector.js     ← MediaPipe FaceLandmarker wrapper
│   │   ├── overlay.js           ← Draws frames on canvas using landmarks
│   │   ├── frame-matcher.js     ← Detects product from page URL/meta
│   │   └── analytics.js         ← Sends anonymous interaction events
│   ├── package.json
│   ├── vite.config.js           ← Bundles to single tryon.js file
│   └── README.md
│
├── api/                         ← Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          ← Register, login, JWT
│   │   │   ├── shops.js         ← Shop profile management
│   │   │   ├── frames.js        ← Frame upload/manage
│   │   │   ├── widget.js        ← Public widget endpoints (key-auth)
│   │   │   ├── analytics.js     ← Try-on event ingestion
│   │   │   └── billing.js       ← Stripe webhooks + subscriptions
│   │   ├── middleware/
│   │   │   ├── auth.js          ← JWT validation
│   │   │   ├── apiKey.js        ← Widget API key validation
│   │   │   └── rateLimit.js     ← Per-key rate limiting
│   │   ├── services/
│   │   │   ├── stripe.js        ← Stripe subscription logic
│   │   │   ├── storage.js       ← Cloudflare R2 uploads
│   │   │   ├── imageProcess.js  ← Background removal (rembg)
│   │   │   └── faceShape.js     ← Calls ML microservice
│   │   ├── models/              ← Prisma schema lives in prisma/
│   │   └── server.js            ← Express app entry point
│   ├── prisma/
│   │   └── schema.prisma        ← Database schema
│   ├── package.json
│   └── README.md
│
├── dashboard/                   ← Next.js shop owner dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/       ← Login page
│   │   │   │   └── register/    ← Register page
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.js      ← Overview/stats
│   │   │   │   ├── frames/      ← Upload + manage frames
│   │   │   │   ├── settings/    ← Widget customization
│   │   │   │   ├── embed/       ← Get embed code
│   │   │   │   └── billing/     ← Plan management
│   │   └── components/
│   ├── package.json
│   └── README.md
│
├── ml/                          ← All AI/ML code
│   ├── face-shape-classifier/   ← MobileNetV2 fine-tuned model
│   ├── fit-scorer/              ← GBM fit quality model
│   └── training-pipeline/       ← Weekly retraining cron scripts
│
└── infra/
    ├── nginx.conf               ← Reverse proxy config
    ├── docker-compose.yml       ← Local dev environment
    └── deploy.sh                ← Hetzner deployment script
```

---

## 🏁 Milestones

### Milestone 1 — Working Widget (Week 1–2)
> Goal: A person can open the widget on any webpage, see their face, and glasses overlay on it accurately

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1.1 | Set up widget project with Vite | Dev | ⬜ | `cd widget && npm init` |
| 1.2 | Implement camera access (getUserMedia) | Dev | ⬜ | Handle permissions denied gracefully |
| 1.3 | Integrate MediaPipe FaceLandmarker | Dev | ⬜ | Use WASM backend for browser |
| 1.4 | Extract key landmarks (nose bridge, temples, eyes) | Dev | ⬜ | See ARCHITECTURE.md for landmark indices |
| 1.5 | Draw frame PNG overlay on canvas | Dev | ⬜ | Scale to face width ratio |
| 1.6 | Apply head rotation correction | Dev | ⬜ | Use face transformation matrix |
| 1.7 | Test on mobile (Android Chrome + iOS Safari) | Dev | ⬜ | Critical — most users on mobile |
| 1.8 | Handle no-face-detected state gracefully | Dev | ⬜ | Show guidance UI |

**Exit criteria:** Glasses stick to face when head moves, tested on 3 different devices

---

### Milestone 2 — Embed System (Week 3)
> Goal: Shop owner adds one `<script>` tag, floating button appears on their site

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 2.1 | Widget reads `data-key` from script tag | Dev | ⬜ | |
| 2.2 | Widget calls API to validate key + fetch config | Dev | ⬜ | Returns frames list, branding |
| 2.3 | Widget injects floating "Try On" button into DOM | Dev | ⬜ | Bottom-right, configurable |
| 2.4 | Frame matcher — detect product from page URL | Dev | ⬜ | Match by URL pattern or meta tag |
| 2.5 | Bundle widget to single tryon.js via Vite | Dev | ⬜ | Target < 300kb gzipped |
| 2.6 | Serve widget from Cloudflare CDN | Dev | ⬜ | Upload to R2, set cache headers |
| 2.7 | Domain whitelist check (key only works on registered domain) | Dev | ⬜ | Security |
| 2.8 | Widget loads async, doesn't block page render | Dev | ⬜ | Use `defer` attribute |

**Exit criteria:** Paste 1 line into any HTML file, widget appears within 2 seconds

---

### Milestone 3 — Backend API (Week 4)
> Goal: All API endpoints working, shop data persisted, frames stored in cloud

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 3.1 | Set up Node.js + Express project | Dev | ⬜ | |
| 3.2 | Set up PostgreSQL + Prisma schema | Dev | ⬜ | See schema in ARCHITECTURE.md |
| 3.3 | Set up Redis for config caching | Dev | ⬜ | Widget config cached 5 min |
| 3.4 | Auth routes — register, login, JWT | Dev | ⬜ | bcrypt + jsonwebtoken |
| 3.5 | Shop routes — CRUD | Dev | ⬜ | |
| 3.6 | Frame routes — upload, list, delete | Dev | ⬜ | |
| 3.7 | Connect Cloudflare R2 for image storage | Dev | ⬜ | Use AWS SDK (R2 is S3-compatible) |
| 3.8 | Background removal on frame upload | Dev | ⬜ | Use rembg Python microservice |
| 3.9 | Widget config endpoint (public, key-auth) | Dev | ⬜ | Returns frames + settings |
| 3.10 | Analytics event ingestion endpoint | Dev | ⬜ | Accept try-on events, store in DB |
| 3.11 | Rate limiting per API key | Dev | ⬜ | Use redis-based rate limiter |
| 3.12 | Input validation on all routes | Dev | ⬜ | Use zod or joi |
| 3.13 | Error handling middleware | Dev | ⬜ | Consistent error format |

**Exit criteria:** All endpoints return correct responses, tested with Postman/Insomnia

---

### Milestone 4 — Dashboard (Week 5)
> Goal: Shop owner can register, upload frames, and get embed code

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 4.1 | Set up Next.js project | Dev | ⬜ | App router |
| 4.2 | Login / Register pages | Dev | ⬜ | JWT stored in httpOnly cookie |
| 4.3 | Dashboard overview — try-on stats | Dev | ⬜ | Today, 7-day, 30-day totals |
| 4.4 | Frames page — upload frame PNGs | Dev | ⬜ | Drag and drop, preview |
| 4.5 | Frame management — name, link to product URL | Dev | ⬜ | |
| 4.6 | Settings page — widget customization | Dev | ⬜ | Button color, position, text |
| 4.7 | Embed page — show copy-paste script tag | Dev | ⬜ | One-click copy |
| 4.8 | API key display + regenerate | Dev | ⬜ | |
| 4.9 | Protect routes (redirect to login if unauth) | Dev | ⬜ | |
| 4.10 | Responsive design (works on mobile) | Dev | ⬜ | |

**Exit criteria:** Full end-to-end flow: register → upload frame → copy embed → paste on test page → widget shows frame

---

### Milestone 5 — Billing (Week 6)
> Goal: Shops can subscribe, plans are enforced, Stripe handles payments

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 5.1 | Create Stripe products + prices (Starter/Growth/Pro) | Dev | ⬜ | Do in Stripe dashboard |
| 5.2 | Stripe Checkout session endpoint | Dev | ⬜ | Redirect to Stripe hosted page |
| 5.3 | Stripe webhook handler | Dev | ⬜ | Handle subscription events |
| 5.4 | Store subscription status in DB | Dev | ⬜ | |
| 5.5 | Enforce plan limits (frame count, try-on count) | Dev | ⬜ | Check on every API call |
| 5.6 | Billing page in dashboard | Dev | ⬜ | Current plan, upgrade button |
| 5.7 | Stripe Customer Portal integration | Dev | ⬜ | Let customer manage sub themselves |
| 5.8 | Trial period (14 days free) | Dev | ⬜ | Set in Stripe product config |
| 5.9 | Subscription expired → widget shows fallback | Dev | ⬜ | Graceful degradation |

**Exit criteria:** Full payment flow tested in Stripe test mode, subscription stored, limits enforced

---

### Milestone 6 — Analytics (Week 7)
> Goal: Shop owners see how many try-ons, which frames are popular

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 6.1 | Widget sends try-on events (open, frame_tried, share, checkout) | Dev | ⬜ | Batched, async |
| 6.2 | Store events in analytics_events table | Dev | ⬜ | |
| 6.3 | Daily summary aggregation cron | Dev | ⬜ | Runs at midnight |
| 6.4 | Dashboard charts — daily try-ons | Dev | ⬜ | Use recharts or chart.js |
| 6.5 | Top frames ranking | Dev | ⬜ | |
| 6.6 | Conversion tracking (try-on → checkout) | Dev | ⬜ | Requires URL param or pixel |

**Exit criteria:** After 10 test try-ons, dashboard shows accurate counts and top frames

---

### Milestone 7 — AI: Face Shape Classifier (Week 7–8)
> Goal: Widget recommends frames based on detected face shape

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 7.1 | Download and prep CelebA dataset | ML Dev | ⬜ | 200k face images, free |
| 7.2 | Label ~2000 images with face shape classes | ML Dev | ⬜ | Oval/Round/Square/Heart/Oblong/Diamond |
| 7.3 | Fine-tune MobileNetV2 on face shapes | ML Dev | ⬜ | Transfer learning, ~2hrs training |
| 7.4 | Export model to ONNX format | ML Dev | ⬜ | For Node.js inference |
| 7.5 | Face shape inference endpoint in API | Dev | ⬜ | POST /ml/face-shape |
| 7.6 | Widget sends face snapshot on open | Dev | ⬜ | Low-res, privacy-blurred |
| 7.7 | Widget shows "Recommended for your face shape" section | Dev | ⬜ | |
| 7.8 | Shop owner can tag frames with styles | Dev | ⬜ | rectangular/round/aviator etc. |

**Exit criteria:** Face shape detected with >75% accuracy on test images, widget shows relevant recommendations

---

### Milestone 8 — AI: Fit Scorer + Learning Loop (Month 3+)
> Goal: System improves placement and recommendations over time from real usage data

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 8.1 | Collect face landmark ratios per session (anonymous) | Dev | ⬜ | Store in face_sessions table |
| 8.2 | Collect manual adjustment offsets | Dev | ⬜ | Did user drag frame? By how much? |
| 8.3 | Collect conversion signal (try-on → checkout) | Dev | ⬜ | Strongest training signal |
| 8.4 | Build fit scorer training script | ML Dev | ⬜ | GradientBoosting on interaction data |
| 8.5 | Weekly retraining cron job | ML Dev | ⬜ | Runs Sunday midnight |
| 8.6 | Model versioning — store each trained model | ML Dev | ⬜ | Never overwrite, keep history |
| 8.7 | A/B test new model vs old | ML Dev | ⬜ | Route 10% traffic to new model |
| 8.8 | Auto-correct placement offsets per face shape | Dev | ⬜ | Use learned offsets |

**Exit criteria:** System automatically improves placement accuracy after 5,000+ sessions collected

---

### Milestone 9 — Production Deploy (Month 2)
> Goal: Live on real domain, HTTPS, monitoring, ready for first customers

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 9.1 | Provision Hetzner CX21 VPS | Dev | ⬜ | ~$6/month |
| 9.2 | Set up Nginx reverse proxy | Dev | ⬜ | See infra/nginx.conf |
| 9.3 | SSL via Let's Encrypt / Certbot | Dev | ⬜ | Auto-renews |
| 9.4 | Deploy API as PM2 process | Dev | ⬜ | Auto-restart on crash |
| 9.5 | Deploy dashboard as Next.js | Dev | ⬜ | |
| 9.6 | Set up Cloudflare for CDN + DNS | Dev | ⬜ | Free tier |
| 9.7 | Upload widget JS to Cloudflare R2 | Dev | ⬜ | Serve from CDN |
| 9.8 | Set up error monitoring (Sentry free tier) | Dev | ⬜ | |
| 9.9 | Set up uptime monitoring (UptimeRobot free) | Dev | ⬜ | |
| 9.10 | Database backups (daily pg_dump to R2) | Dev | ⬜ | |
| 9.11 | Environment variables documented | Dev | ⬜ | See .env.example |

**Exit criteria:** App reachable on public URL, HTTPS, survives server restart

---

### Milestone 10 — Polish + Launch (Month 2)
> Goal: Ready to show to first paying customers

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 10.1 | Landing page (Next.js, same codebase) | Dev | ⬜ | Show demo video, pricing, sign up CTA |
| 10.2 | Demo page with sample glasses shop | Dev | ⬜ | Let visitors try without signing up |
| 10.3 | Onboarding flow (guided setup after register) | Dev | ⬜ | |
| 10.4 | Email on register (welcome + setup guide) | Dev | ⬜ | Use Resend free tier |
| 10.5 | Documentation page — how to install | Dev | ⬜ | |
| 10.6 | Widget works on Shopify (test with real store) | Dev | ⬜ | |
| 10.7 | Widget works on WooCommerce (test) | Dev | ⬜ | |
| 10.8 | Widget works on custom HTML (test) | Dev | ⬜ | |
| 10.9 | Cross-browser test (Chrome, Firefox, Safari, Edge) | Dev | ⬜ | |
| 10.10 | Performance: widget loads in < 3s on 4G | Dev | ⬜ | |

**Exit criteria:** 3 external people (non-devs) successfully install and use the widget without help

---

## 🔮 Future Roadmap (Post-Launch)

| Feature | Priority | Effort |
|---|---|---|
| Photo mode (upload selfie instead of live camera) | High | Medium |
| Shopify App Store listing | High | Medium |
| WooCommerce plugin | Medium | Medium |
| Face shape style guide (in widget) | Medium | Low |
| Multiple glasses comparison side-by-side | Medium | High |
| Share try-on to social media | Medium | Medium |
| Jewelry shop expansion | High | High |
| Hat/cap expansion | Medium | High |
| Watch expansion | Low | High |
| White-label option for agencies | Low | Low |

---

## 🧱 Tech Stack Reference

| Layer | Tech | Version | Why |
|---|---|---|---|
| Widget | Vanilla JS | ES2022 | No deps, works anywhere |
| Widget bundler | Vite | 5.x | Fast, tiny output |
| Widget AI | MediaPipe FaceLandmarker | Latest | 468 landmarks, free, runs in browser |
| Backend | Node.js + Express | 20 LTS | Fast API, same language as widget |
| ORM | Prisma | 5.x | Clean schema, migrations |
| Database | PostgreSQL | 16 | Reliable, free |
| Cache | Redis | 7 | Widget config caching |
| File storage | Cloudflare R2 | - | Near-free, S3-compatible |
| CDN | Cloudflare | Free tier | Global, fast |
| Payments | Stripe | Latest | Industry standard |
| Dashboard | Next.js | 14 | App router, SSR |
| ML - Face shape | TensorFlow/Keras | 2.x | MobileNetV2 fine-tuning |
| ML - Fit scorer | scikit-learn | 1.x | GradientBoosting, ONNX export |
| ML runtime | onnxruntime-node | Latest | Run ONNX models in Node.js |
| Email | Resend | Free tier | Simple API |
| Monitoring | Sentry | Free tier | Error tracking |
| Hosting | Hetzner CX21 | ~$6/mo | Cheapest, reliable |
| Process mgr | PM2 | Latest | Auto-restart |

---

## 💰 Pricing Tiers

| Plan | Price | Frame limit | Try-on limit/mo | Notes |
|---|---|---|---|---|
| Free Trial | $0 | 5 frames | 100 try-ons | 14 days only |
| Starter | $19/mo | 20 frames | 500 try-ons | For small shops |
| Growth | $39/mo | 100 frames | 5,000 try-ons | Most popular |
| Pro | $79/mo | Unlimited | Unlimited | + analytics API |

---

## 🌍 Environment Variables

See `api/.env.example` and `dashboard/.env.example` for all required vars.

Critical vars:
```
DATABASE_URL          — PostgreSQL connection string
REDIS_URL             — Redis connection string
JWT_SECRET            — Random 64-char string
STRIPE_SECRET_KEY     — From Stripe dashboard
STRIPE_WEBHOOK_SECRET — From Stripe webhook settings
R2_ACCESS_KEY_ID      — Cloudflare R2 credentials
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
RESEND_API_KEY        — For transactional email
```

---

## 📞 Key Contacts & Resources

- MediaPipe Docs: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
- Stripe Docs: https://stripe.com/docs
- Cloudflare R2 Docs: https://developers.cloudflare.com/r2
- Prisma Docs: https://www.prisma.io/docs
- Hetzner Console: https://console.hetzner.cloud
