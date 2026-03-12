# TryOn SaaS - Developer Guide

A step-by-step guide to set up, run, and integrate the TryOn virtual try-on widget. Written for developers of all experience levels.

---

## Table of Contents

1. [What Is TryOn?](#1-what-is-tryon)
2. [What You Need Before Starting](#2-what-you-need-before-starting)
3. [Project Structure Overview](#3-project-structure-overview)
4. [Setting Up the Project in VS Code](#4-setting-up-the-project-in-vs-code)
5. [Starting the Database and Services](#5-starting-the-database-and-services)
6. [Setting Up the API Server](#6-setting-up-the-api-server)
7. [Viewing and Managing the Database](#7-viewing-and-managing-the-database)
8. [Setting Up the Dashboard](#8-setting-up-the-dashboard)
9. [Setting Up the Widget](#9-setting-up-the-widget)
10. [Running Everything Together](#10-running-everything-together)
11. [Using the Product (End-to-End Walkthrough)](#11-using-the-product-end-to-end-walkthrough)
12. [Integrating the Widget Into a Customer's Website](#12-integrating-the-widget-into-a-customers-website)
13. [Common Issues and Troubleshooting](#13-common-issues-and-troubleshooting)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Useful Commands Cheat Sheet](#15-useful-commands-cheat-sheet)

---

## 1. What Is TryOn?

TryOn is a virtual "try-on" widget for eyewear stores. It lets online shoppers see how glasses look on their face using their webcam, in real-time. Think of it like a Snapchat filter, but for glasses.

**The product has 3 main parts:**

| Part | What It Does | Who Uses It |
|------|-------------|-------------|
| **Widget** | The camera overlay that shoppers see on a store's website | End customers (shoppers) |
| **Dashboard** | Where shop owners upload their glasses frames and see analytics | Shop owners |
| **API** | The backend server that connects everything together | Both (behind the scenes) |

---

## 2. What You Need Before Starting

Install these tools on your computer before proceeding. All are free.

### Required

| Tool | Version | Download Link | What It's For |
|------|---------|---------------|---------------|
| **Node.js** | 18 or higher (20 LTS recommended) | https://nodejs.org | Runs the API and dashboard servers |
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop | Runs the database (PostgreSQL) and cache (Redis) |
| **Visual Studio Code** | Latest | https://code.visualstudio.com | Code editor |
| **Git** | Latest | https://git-scm.com | Version control |

### Optional

| Tool | What It's For |
|------|---------------|
| **Python 3.10+** | Only needed if you want to run the ML training scripts |
| **Postman** or **Thunder Client** (VS Code extension) | Helpful for testing API endpoints manually |

### How to Check If You Have Them

Open a terminal (Command Prompt, PowerShell, or VS Code terminal) and run:

```bash
node --version     # Should show v18.x.x or higher
docker --version   # Should show Docker version 2x.x.x
git --version      # Should show git version 2.x.x
```

---

## 3. Project Structure Overview

When you open the project in VS Code, you'll see these top-level folders:

```
ProjectX/
├── api/            # Backend server (Express.js)
│   ├── src/        #   Source code
│   │   ├── routes/       # API endpoint handlers
│   │   ├── middleware/   # Auth, error handling
│   │   └── services/     # Business logic (storage, ML scoring)
│   └── prisma/     #   Database schema and migrations
│
├── dashboard/      # Shop owner web app (Next.js)
│   └── src/app/    #   Pages and components
│
├── widget/         # Embeddable AR try-on (Vanilla JS)
│   ├── src/        #   Source code
│   └── test.html   #   Test page for trying the widget locally
│
├── ml/             # Machine learning scripts (Python)
│   ├── fit-scorer/   # Fit recommendation model
│   └── rembg-service/# Background removal microservice
│
├── infra/          # Deployment configs
│   ├── docker-compose.yml  # Local database setup
│   ├── nginx.conf          # Production proxy config
│   └── deploy.sh           # Production deploy script
│
└── docs/           # Documentation
```

---

## 4. Setting Up the Project in VS Code

### Step 1: Clone the Repository

Open VS Code, then open the integrated terminal with `` Ctrl+` `` (backtick key).

```bash
git clone https://github.com/FaisalNabil/tryon.git
cd tryon
```

### Step 2: Open the Project

In VS Code, go to **File > Open Folder** and select the `tryon` folder you just cloned.

### Step 3: Recommended VS Code Extensions

Open the Extensions panel (`Ctrl+Shift+X`) and install these:

| Extension | Why |
|-----------|-----|
| **Prisma** | Syntax highlighting for database schema files |
| **ESLint** | JavaScript code quality checks |
| **Tailwind CSS IntelliSense** | Autocomplete for dashboard CSS classes |
| **Thunder Client** | Test API endpoints without leaving VS Code |
| **Docker** | Manage Docker containers from VS Code sidebar |

### Step 4: Open Multiple Terminals

You'll need **3 separate terminals** running at the same time (one for each service). In VS Code:

1. Open the first terminal: `` Ctrl+` ``
2. Click the **+** button in the terminal panel to add more
3. Rename them (right-click the tab) to: `API`, `Dashboard`, `Widget`

---

## 5. Starting the Database and Services

The project uses **PostgreSQL** (database) and **Redis** (cache). The easiest way to run them is with Docker.

### Step 1: Make Sure Docker Desktop Is Running

Open Docker Desktop. You should see it in your system tray. Wait until it says "Docker Desktop is running".

### Step 2: Start the Containers

In any VS Code terminal:

```bash
cd infra
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5433` (the database where all data is stored)
- **Redis** on port `6379` (a fast cache for widget configuration)

You should see output like:
```
✔ Container infra-postgres-1  Started
✔ Container infra-redis-1     Started
```

### Step 3: Verify They're Running

```bash
docker compose ps
```

You should see both containers with status `Up`.

### Stopping the Containers (When You're Done)

```bash
cd infra
docker compose down
```

> **Note:** Your data is saved in a Docker volume called `pgdata`, so it persists even when you stop the containers. To completely wipe the database and start fresh, run `docker compose down -v`.

---

## 6. Setting Up the API Server

The API is the backbone — it handles authentication, stores data, and serves the widget configuration.

### Step 1: Navigate to the API Folder

In the **API** terminal:

```bash
cd api
```

### Step 2: Create Your Environment File

```bash
cp .env.example .env
```

### Step 3: Edit the .env File

Open `api/.env` in VS Code and update these values:

```env
# Database — IMPORTANT: port is 5433 (not the default 5432)
# because our Docker setup maps to 5433 to avoid conflicts
DATABASE_URL=postgresql://tryon:tryon@localhost:5433/tryon

# Redis
REDIS_URL=redis://localhost:6379

# Auth — change this to any random string (at least 32 characters)
JWT_SECRET=my-super-secret-key-change-this-in-production

# Server
PORT=3000
DASHBOARD_URL=http://localhost:3001

# Stripe (leave as-is for now — billing won't work without real keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_PRO=price_...

# Cloudflare R2 (leave blank for now — frame upload will use fallback)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=tryon-frames
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://cdn.yourdomain.com

# Background removal service
REMBG_URL=http://localhost:5000

# Email (leave as-is for now)
RESEND_API_KEY=re_...
```

> **The only values you MUST change for local development:**
> - `DATABASE_URL` — make sure the port is `5433`
> - `JWT_SECRET` — change to any random string

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Set Up the Database Tables

This creates all the tables in PostgreSQL based on the schema:

```bash
npx prisma migrate dev --name init
```

You'll see output about creating tables (Shop, Frame, Subscription, etc.).

Then generate the Prisma client:

```bash
npx prisma generate
```

### Step 6: Start the API Server

```bash
npm run dev
```

You should see:

```
[API] Running on http://localhost:3000
```

### Step 7: Verify It's Working

Open a browser and visit: http://localhost:3000/health

You should see:

```json
{ "ok": true, "ts": 1234567890 }
```

---

## 7. Viewing and Managing the Database

Prisma comes with a built-in visual database browser called **Prisma Studio**. It lets you view and edit all your data through a nice web interface — no SQL knowledge needed.

### Opening Prisma Studio

Open a **new terminal** in VS Code (keep the API server running in the other one):

```bash
cd api
npx prisma studio
```

This opens a browser window at http://localhost:5555 showing all your database tables:

| Table | What's In It |
|-------|-------------|
| **Shop** | Registered shop owners (email, password, API key, plan) |
| **Frame** | Glasses frames uploaded by shop owners |
| **Subscription** | Stripe billing subscriptions |
| **AnalyticsSession** | Individual widget try-on sessions |
| **AnalyticsEvent** | Detailed events (widget opened, frame tried, etc.) |
| **ModelVersion** | ML model version history |

### What You Can Do in Prisma Studio

- **Browse records**: Click any table to see all rows
- **Filter**: Use the filter bar to search by any field
- **Edit**: Click any cell to modify it (then click "Save 1 change")
- **Add records**: Click "Add record" to manually insert data
- **Delete**: Select rows and click "Delete X records"

### Connecting with a SQL Client (Advanced)

If you prefer a dedicated database tool (like **pgAdmin**, **DBeaver**, or **TablePlus**), use these connection details:

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5433` |
| Database | `tryon` |
| Username | `tryon` |
| Password | `tryon` |

**Connection string:** `postgresql://tryon:tryon@localhost:5433/tryon`

### VS Code Database Extension (Alternative)

You can also install the **PostgreSQL** extension for VS Code:

1. Install the extension: **Database Client** by Weijan Chen
2. Click the database icon in the left sidebar
3. Click **+** to add a new connection
4. Fill in: Host = localhost, Port = 5433, User = tryon, Password = tryon, Database = tryon
5. Click Connect

Now you can browse tables, run SQL queries, and export data — all inside VS Code.

---

## 8. Setting Up the Dashboard

The dashboard is the web app where shop owners manage their frames and see analytics.

### Step 1: Navigate to the Dashboard Folder

In the **Dashboard** terminal:

```bash
cd dashboard
```

### Step 2: Create Your Environment File

```bash
cp .env.example .env.local
```

### Step 3: Verify the .env.local File

Open `dashboard/.env.local` in VS Code. It should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_WIDGET_CDN=https://cdn.yourdomain.com
```

The default values work for local development — no changes needed.

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Start the Dashboard

```bash
npm run dev
```

You should see:

```
▲ Next.js 14.x.x
- Local: http://localhost:3001
```

### Step 6: Open the Dashboard

Open a browser and visit: http://localhost:3001

You'll see the login page. Since you don't have an account yet, click **Register** to create one.

---

## 9. Setting Up the Widget

The widget is the embeddable AR try-on component that end customers interact with.

### Step 1: Navigate to the Widget Folder

In the **Widget** terminal:

```bash
cd widget
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start the Widget Dev Server

```bash
npm run dev
```

You should see:

```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:5173/
```

> **Note:** The widget dev server doesn't show a page at http://localhost:5173 — that's normal. The widget is designed to be loaded by other pages (like the test page). We'll use it in the next section.

---

## 10. Running Everything Together

Here's the complete startup sequence. You need **all 3 services running** for the full product to work.

### Startup Checklist

Open 3 terminals in VS Code and run these commands in order:

**Terminal 1 — Infrastructure (if not already running):**
```bash
cd infra
docker compose up -d
```

**Terminal 2 — API:**
```bash
cd api
npm run dev
```
Wait until you see `[API] Running on http://localhost:3000`

**Terminal 3 — Dashboard:**
```bash
cd dashboard
npm run dev
```
Wait until you see `Local: http://localhost:3001`

**Terminal 4 — Widget:**
```bash
cd widget
npm run dev
```
Wait until you see `Local: http://localhost:5173`

### Service Map

| Service | URL | Status Check |
|---------|-----|-------------|
| API | http://localhost:3000 | Visit http://localhost:3000/health |
| Dashboard | http://localhost:3001 | Open in browser |
| Widget Dev | http://localhost:5173 | Used by test page (see below) |
| Database | localhost:5433 | `docker compose ps` |
| Redis | localhost:6379 | `docker compose ps` |
| Prisma Studio | http://localhost:5555 | Run `npx prisma studio` from `api/` |

---

## 11. Using the Product (End-to-End Walkthrough)

Here's how to use every feature from start to finish.

### Step 1: Create a Shop Owner Account

1. Open http://localhost:3001 in your browser
2. Click **Register**
3. Fill in:
   - **Email**: any email (e.g., `demo@test.com`)
   - **Password**: at least 8 characters (e.g., `demo1234`)
   - **Shop Name**: anything (e.g., `My Eyewear Store`)
4. Click **Register**

You'll be automatically logged in and redirected to the dashboard.

### Step 2: Upload Glasses Frames

1. In the dashboard, click **Frames** in the sidebar
2. Click **Upload Frame**
3. Fill in:
   - **Name**: e.g., `Aviator Classic`
   - **Style**: Select a style (e.g., `aviator`) — this is used for fit scoring
   - **Image**: Upload a PNG image of glasses (ideally transparent background)
   - **Product URL** (optional): Link to the product page on your store
4. Click **Upload**
5. Repeat for more frames

> **Tip:** For testing, you can upload any glasses image. The AR overlay works best with transparent PNG images of glasses (front-facing view).

### Step 3: Get Your API Key

1. Click **Embed** in the sidebar
2. You'll see your **API Key** — this is what connects the widget to your shop
3. Click **Copy** to copy it to your clipboard

### Step 4: Test the Widget

1. Open the file `widget/test.html` in your browser
   - You can open it directly: right-click the file in VS Code > "Open with Live Server" or just double-click it in your file explorer
   - Or navigate to: `file:///D:/Codes/ProjectX/widget/test.html`
2. Paste your API key into the input field
3. Click **Load Widget**
4. A "Try On" button should appear in the bottom-right corner
5. Click it to open the AR camera
6. Allow camera access when prompted
7. Position your face in the center — you should see the glasses overlaid on your face
8. Try different frames using the selector at the bottom
9. After your face shape is detected, you'll see fit score badges on each frame

### Step 5: View Analytics

1. Go back to the dashboard at http://localhost:3001
2. Click **Dashboard** (overview page)
3. You'll see stats from your test session:
   - Total try-ons
   - Unique sessions
   - Top frames
   - Daily chart

### Step 6: Customize the Widget

1. Click **Settings** in the sidebar
2. You can change:
   - **Button color** — the color of the "Try On" floating button
   - **Primary color** — accent color used in the modal
   - **Button position** — bottom-left or bottom-right
   - **Button text** — what the button says (default: "Try On")
3. Click **Save** — changes appear on the widget immediately (after Redis cache expires in 5 minutes, or restart the API)

---

## 12. Integrating the Widget Into a Customer's Website

This section explains how a shop owner installs the widget on their own website. Share this with your customers.

### The Basic Concept

The widget is a single JavaScript file that the shop owner adds to their website. It only needs **one line of code**. The widget then:

1. Loads on the page
2. Shows a floating "Try On" button
3. When clicked, opens a camera modal
4. Overlays the shop's glasses frames on the customer's face in real-time
5. Detects the customer's face shape and recommends the best-fitting frames

### Method 1: Basic HTML (Any Website)

Add this single line of code before the closing `</body>` tag on your website:

```html
<script src="https://cdn.yourdomain.com/tryon.js" data-key="YOUR_API_KEY" defer></script>
```

Replace:
- `https://cdn.yourdomain.com/tryon.js` with your actual CDN URL where the widget JS is hosted
- `YOUR_API_KEY` with the API key from the dashboard's Embed page

**Example — Full HTML Page:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Eyewear Store</title>
</head>
<body>

  <h1>Welcome to My Store</h1>
  <p>Browse our collection of glasses below.</p>

  <!-- Your normal website content here -->

  <!-- TryOn Widget — add this one line -->
  <script src="https://cdn.yourdomain.com/tryon.js" data-key="tk_abc123..." defer></script>

</body>
</html>
```

That's it! The floating "Try On" button will appear automatically.

### Method 2: Shopify

1. Log in to your Shopify admin panel
2. Go to **Online Store > Themes**
3. Click **Actions > Edit code** (or click the three dots > Edit code)
4. In the left sidebar, open **Layout > theme.liquid**
5. Find the closing `</head>` tag
6. Paste this right before it:

```html
{% comment %} TryOn Virtual Try-On Widget {% endcomment %}
<script src="https://cdn.yourdomain.com/tryon.js" data-key="YOUR_API_KEY" defer></script>
```

7. Click **Save**

The widget will now appear on every page of your Shopify store.

### Method 3: WordPress / WooCommerce

**Option A — Using a Plugin (Easiest)**

1. Install the **Insert Headers and Footers** plugin (by WPCode)
2. Go to **Settings > Insert Headers and Footers**
3. In the **"Scripts in Header"** box, paste:

```html
<script src="https://cdn.yourdomain.com/tryon.js" data-key="YOUR_API_KEY" defer></script>
```

4. Click **Save**

**Option B — Editing the Theme (Advanced)**

1. Go to **Appearance > Theme File Editor**
2. Open `header.php`
3. Paste the script tag before the closing `</head>` tag
4. Click **Update File**

### Method 4: Wix

1. Go to your Wix site editor
2. Click **Settings** (gear icon) in the left menu
3. Scroll down to **Custom Code** (under "Advanced")
4. Click **+ Add Custom Code**
5. Paste the script tag:

```html
<script src="https://cdn.yourdomain.com/tryon.js" data-key="YOUR_API_KEY" defer></script>
```

6. Set placement to: **Body - end**
7. Set pages to: **All pages**
8. Click **Apply**

### Method 5: Squarespace

1. Go to **Settings > Advanced > Code Injection**
2. In the **Footer** section, paste:

```html
<script src="https://cdn.yourdomain.com/tryon.js" data-key="YOUR_API_KEY" defer></script>
```

3. Click **Save**

### Method 6: Custom React / Next.js App

```jsx
// In your layout component or _app.js
import Script from 'next/script'

export default function Layout({ children }) {
  return (
    <>
      {children}
      <Script
        src="https://cdn.yourdomain.com/tryon.js"
        data-key="YOUR_API_KEY"
        strategy="lazyOnload"
      />
    </>
  )
}
```

### Method 7: Vue.js / Nuxt

```html
<!-- In your App.vue or nuxt.config.js -->
<template>
  <div id="app">
    <!-- Your app content -->
  </div>
</template>

<script>
export default {
  mounted() {
    const script = document.createElement('script')
    script.src = 'https://cdn.yourdomain.com/tryon.js'
    script.setAttribute('data-key', 'YOUR_API_KEY')
    script.defer = true
    document.body.appendChild(script)
  }
}
</script>
```

### How It Works Behind the Scenes

When the script loads on a shop owner's website:

1. **Reads the API key** from the `data-key` attribute on the script tag
2. **Calls the API** (`GET /v1/widget/config?key=...`) to fetch the shop's frames and settings
3. **Creates a Shadow DOM** — this isolates the widget's styles so they don't conflict with the shop's CSS
4. **Shows a floating button** ("Try On") in the corner specified by the shop's settings
5. **On click**: Opens a modal with the camera feed, loads MediaPipe face detection (WASM), and starts the 30fps AR render loop
6. **Face detection**: Detects 468 face landmarks, calculates the glasses position, and overlays the selected frame image
7. **Fit scoring**: After detecting the face shape, calls the ML endpoint to score each frame's fit and shows badges
8. **Analytics**: Batches and sends events (opens, frames tried, etc.) to the API for the dashboard stats

### Verifying the Integration

After adding the widget to a website:

1. Open the website in a browser
2. Look for the "Try On" button (default: bottom-right corner)
3. Open **DevTools** (F12) and check the **Console** tab for any errors
4. If you see `[TryOn] No script tag found` — the script tag is missing the `data-key` attribute
5. If you see `[TryOn] Missing data-key` — the API key is empty
6. If the button doesn't appear — check the API key is correct and the API server is running

### Testing Locally During Development

For local development testing, use the built-in test page:

1. Make sure the API (`npm run dev` in `api/`) and Widget dev server (`npm run dev` in `widget/`) are both running
2. Open `widget/test.html` in your browser
3. Paste your API key from the dashboard
4. Click "Load Widget"

---

## 13. Common Issues and Troubleshooting

### "ECONNREFUSED" or "Connection refused" errors

**Cause:** The database or Redis isn't running.

**Fix:**
```bash
cd infra
docker compose up -d
docker compose ps  # verify both are "Up"
```

### "Port 3000 already in use" (EADDRINUSE)

**Cause:** Another process is using port 3000.

**Fix:**
```bash
npx kill-port 3000
npm run dev
```

### "relation does not exist" or database errors

**Cause:** Database tables haven't been created yet.

**Fix:**
```bash
cd api
npx prisma migrate dev --name init
npx prisma generate
```

### Camera doesn't work in the widget

**Possible causes:**
- **HTTPS required**: Most browsers require HTTPS for camera access. When testing locally, use `localhost` (which is exempt from this rule).
- **Permission denied**: Click "Allow" when the browser asks for camera permission. If you accidentally clicked "Block", click the camera icon in the address bar to reset it.
- **No face detected**: Make sure your face is well-lit and centered in the camera view.

### Widget button doesn't appear

**Check:**
1. API server is running (http://localhost:3000/health)
2. The API key is correct (copy it fresh from the dashboard)
3. Open DevTools Console (F12) — look for error messages starting with `[TryOn]`
4. You've uploaded at least one frame in the dashboard

### Dashboard shows blank page or errors

**Fix:**
```bash
cd dashboard
rm -rf .next
npm run dev
```

### Redis connection errors in the API

**Cause:** Redis container isn't running.

**Fix:**
```bash
cd infra
docker compose up -d redis
```

The API will still work without Redis (it just won't cache widget configs), but you'll see error messages in the console.

### "prisma generate" fails

**Fix:**
```bash
cd api
rm -rf node_modules/.prisma
npx prisma generate
```

---

## 14. Running Tests

The API has a full integration test suite with **40 tests** across 5 files, built with [Vitest](https://vitest.dev/).

### Quick Start

```bash
cd api
npm test            # Run all tests once
npm run test:watch  # Re-run on file changes
```

### Prerequisites

Tests run against a **real PostgreSQL database**, so make sure Docker infrastructure is running:

```bash
cd infra && docker compose up -d
```

### Test Files

| File | Tests | What It Covers |
|------|-------|----------------|
| `tests/auth.test.js` | 11 | Register, login, JWT validation, Zod input errors |
| `tests/frames.test.js` | 8 | Frame CRUD, file upload, tenant isolation |
| `tests/widget.test.js` | 5 | Config endpoint, API key auth, active frame filtering |
| `tests/analytics.test.js` | 8 | Batch event ingestion, summary aggregation, face ratios |
| `tests/ml.test.js` | 8 | Fit scoring, batch scoring, dual auth (API key + JWT) |

### How Tests Work

- **`tests/setup.js`** starts the API on a random port, mocks R2 storage and rembg, and cleans the database between each test
- External services (Cloudflare R2, rembg) are mocked — no cloud credentials needed
- Each test creates its own shop via `createTestShop()` so tests are fully isolated
- The server runs with `NODE_ENV=test` which skips `app.listen()` (the test harness manages the port)

---

## 15. Environment Variables Reference

### API (`api/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string. Use port 5433 for Docker setup |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing auth tokens. Use a long random string |
| `PORT` | No | `3000` | Port the API server runs on |
| `DASHBOARD_URL` | No | `http://localhost:3001` | Used for CORS — which domain can make API requests |
| `STRIPE_SECRET_KEY` | No | — | Stripe API key for billing (leave as-is for local dev) |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook signature verification |
| `STRIPE_PRICE_STARTER` | No | — | Stripe price ID for Starter plan |
| `STRIPE_PRICE_GROWTH` | No | — | Stripe price ID for Growth plan |
| `STRIPE_PRICE_PRO` | No | — | Stripe price ID for Pro plan |
| `R2_ACCESS_KEY_ID` | No | — | Cloudflare R2 access key (for frame image storage) |
| `R2_SECRET_ACCESS_KEY` | No | — | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | No | `tryon-frames` | R2 bucket name |
| `R2_ENDPOINT` | No | — | R2 API endpoint URL |
| `R2_PUBLIC_URL` | No | — | Public URL for accessing stored images |
| `REMBG_URL` | No | `http://localhost:5000` | Background removal microservice URL |
| `RESEND_API_KEY` | No | — | Email service API key |

### Dashboard (`dashboard/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | — | The API base URL (e.g., `http://localhost:3000/v1`) |
| `NEXT_PUBLIC_WIDGET_CDN` | No | — | CDN URL for the widget JS file |

### Widget (`widget/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3000/v1` | The API base URL |

---

## 16. Useful Commands Cheat Sheet

### Infrastructure
```bash
cd infra
docker compose up -d        # Start database + Redis
docker compose down          # Stop everything
docker compose down -v       # Stop and DELETE all data
docker compose ps            # Check what's running
docker compose logs postgres # View database logs
```

### API
```bash
cd api
npm run dev                  # Start API in development mode (auto-restart on changes)
npm start                    # Start API in production mode
npm test                     # Run all 40 integration tests (Vitest)
npm run test:watch           # Re-run tests on file changes
npx prisma studio            # Open visual database browser (http://localhost:5555)
npx prisma migrate dev       # Apply database schema changes
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma db push           # Push schema to DB without creating a migration
npx kill-port 3000           # Kill process on port 3000
```

### Dashboard
```bash
cd dashboard
npm run dev                  # Start dashboard dev server (http://localhost:3001)
npm run build                # Build for production
```

### Widget
```bash
cd widget
npm run dev                  # Start Vite dev server (http://localhost:5173)
npm run build                # Build production bundle (outputs to dist/tryon.iife.js)
```

### Git
```bash
git status                   # See what files changed
git add .                    # Stage all changes
git commit -m "description"  # Commit changes
git push                     # Push to GitHub
git pull                     # Pull latest changes
```

### Database (Raw SQL via Docker)
```bash
docker exec -it infra-postgres-1 psql -U tryon -d tryon
```

This opens an interactive SQL shell. Some useful queries:

```sql
-- List all shops
SELECT id, email, "shopName", plan FROM "Shop";

-- List all frames for a shop
SELECT id, name, style, "isActive" FROM "Frame" WHERE "shopId" = 'your-shop-id';

-- Count analytics events
SELECT "eventType", COUNT(*) FROM "AnalyticsEvent" GROUP BY "eventType";

-- Exit the SQL shell
\q
```

---

## Need Help?

- **API endpoints**: Check the route files in `api/src/routes/` — each file has detailed JSDoc comments
- **Database schema**: Open `api/prisma/schema.prisma` to see all tables and relationships
- **Widget internals**: Check `widget/src/` — each file has a header comment explaining what it does
- **Project plan**: See `docs/PROJECT_PLAN.md` for the full development roadmap
