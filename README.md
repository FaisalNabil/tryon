# TryOn SaaS

> Virtual glasses try-on widget for any eyewear e-commerce website.  
> Shop owners add one `<script>` tag. Their customers can try on glasses using AR.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.10+
- Docker + Docker Compose

### 1. Start infrastructure
```bash
cd infra
docker compose up -d
# Starts PostgreSQL, Redis, rembg service
```

### 2. Set up API
```bash
cd api
cp .env.example .env
# Edit .env with your values

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
# API running on http://localhost:3000
```

### 3. Set up Dashboard
```bash
cd dashboard
cp .env.example .env.local
npm install
npm run dev
# Dashboard running on http://localhost:3001
```

### 4. Build Widget (for development)
```bash
cd widget
npm install
npm run dev
# Widget dev server on http://localhost:5173
```

### 5. Test the widget
Open `widget/test.html` in a browser and paste your API key.

---

## 📁 Project Structure

```
tryon-saas/
├── docs/           ← PROJECT_PLAN.md, API_SPEC.md
├── widget/         ← Embeddable JS widget (Vanilla JS + MediaPipe)
├── api/            ← Node.js + Express backend
├── dashboard/      ← Next.js shop owner dashboard
├── ml/             ← AI models + training scripts
└── infra/          ← Docker, Nginx, deploy scripts
```

## 📋 Project Status

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for full task tracker.

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system design.

## 📡 API Reference

See [docs/API_SPEC.md](docs/API_SPEC.md) for all endpoints.

---

## 📦 How the Widget Works

1. Shop owner registers on dashboard
2. Uploads transparent PNG images of their glasses frames
3. Gets embed code: `<script src="https://cdn.yourdomain.com/tryon.js" data-key="KEY"></script>`
4. Pastes it into their website's `<head>`
5. A "Try On" button appears on their product pages
6. Customers click → camera opens → MediaPipe detects face landmarks → glasses appear on face in real time

---

## 💰 Pricing

| Plan | Price | Frames | Try-ons/mo |
|---|---|---|---|
| Trial | Free (14 days) | 5 | 100 |
| Starter | $19/mo | 20 | 500 |
| Growth | $39/mo | 100 | 5,000 |
| Pro | $79/mo | ∞ | ∞ |
