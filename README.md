# ShopFlow — Mobile-First Offline POS & Cloud Sync

ShopFlow is a fast, offline-first Point of Sale (POS) and inventory management web app designed for small retail counters (selling cigarettes, cold drinks, snacks, chocolates, water, and groceries).

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + PWA (Service Worker)
- **Local Database (Device Source of Truth)**: Dexie.js (IndexedDB)
- **Backend (Cloud Backup & Sync)**: Cloudflare Workers
- **Cloud Database**: Cloudflare D1 (Serverless SQLite)
- **API**: REST with Idempotent Batch Sync (`POST /api/sync`)

The application is **100% offline-first**: all counter operations (sales, payments, stock audits, customer ledgers) execute immediately locally in IndexedDB without waiting for network responses. When internet connectivity is available, events in the local `syncQueue` are automatically dispatched to Cloudflare D1.

---

## Cloudflare Backend & Local Development Setup

### 1. Prerequisites

Make sure you have Node.js (v18+) and npm installed.

### 2. Install Wrangler CLI

Wrangler is Cloudflare's developer CLI. You can install it globally or run it via npx:

```bash
# Verify or install globally
npm install -g wrangler

# Or verify via npx (installed in devDependencies)
npx wrangler --version
```

### 3. Create Cloudflare D1 Database

For production or cloud deployment, create the D1 database:

```bash
cd worker
npx wrangler d1 create shopflow-db
```

This command outputs a `database_id`. Paste that `database_id` into `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "shopflow-db"
database_id = "<YOUR_DATABASE_ID>"
migrations_dir = "migrations"
```

> **Note for Local Development:** For local development, Wrangler automatically simulates D1 locally using an embedded SQLite engine. You do not need a paid Cloudflare account to run and test locally!

### 4. Apply D1 Migrations

Apply the database schema and default demo shop seed:

```bash
# Apply migrations locally (for local development)
cd worker
npx wrangler d1 migrations apply shopflow-db --local

# Apply migrations remotely (when deploying to Cloudflare)
npx wrangler d1 migrations apply shopflow-db --remote
```

### 5. Configure Environment Variables

Environment variables are configured in `worker/wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "development"
DEMO_SHOP_ID = "shop_demo_001"
DEMO_SHOP_NAME = "ShopFlow Demo Counter"
```

Frontend environment variables (optional overrides in `.env.local`):

```bash
# Leave empty in local development to use Vite's internal proxy
VITE_API_URL=
# Or point to production worker:
# VITE_API_URL=https://shopflow-worker.<your-subdomain>.workers.dev
```

### 6. Run Frontend + Worker Locally

To run both the frontend and backend concurrently:

**Terminal 1 — Cloudflare Worker (Port 8787):**
```bash
cd worker
npx wrangler dev
```

**Terminal 2 — Vite Frontend (Port 5173):**
```bash
npm run dev
```

Vite proxies all `/api/*` calls directly to `http://127.0.0.1:8787`, so the frontend and backend communicate without CORS friction.

---

## Cloud API Routes

- `GET  /api/health` — Backend health check and database connectivity
- `POST /api/sync` — Idempotent batch sync of offline event queue
- `GET  /api/bootstrap` — Full cloud snapshot for initial device provisioning or disaster recovery
- `GET  /api/shop/:shopId/products` — Product catalog
- `GET  /api/shop/:shopId/customers` — Customer balances and ledger
- `GET  /api/shop/:shopId/sales` — Historical sales
- `GET  /api/shop/:shopId/inventory` — Stock levels and movement logs
- `GET  /api/shop/:shopId/reports` — Aggregated revenue and expense summaries

---

## Offline Synchronization Engine

1. **Local-First Enqueue**: Every sale, payment, movement, and customer update is saved to IndexedDB first, then an event is enqueued into `syncQueue` (`status: 'PENDING'`).
2. **Deterministic Ordering**: Sync batches are strictly sorted by `createdAt` ascending so dependent events (e.g. `Customer -> Sale -> Payment`) process in chronological order.
3. **Idempotency Guarantee**: All events use client-generated stable UUIDs (`sale_...`, `cust_...`, `sync_...`). Retried or duplicate network requests are acknowledged idempotently without creating duplicate financial or inventory rows.
4. **Automatic Triggers**:
   - Application startup
   - Network `online` event
   - Window `focus` / `visibilitychange`
   - Completion of checkout while online
   - Background periodic retry with exponential backoff (5s, 15s, 30s, 1m, 5m)
5. **Manual Sync**: Shopkeepers can trigger an on-demand sync from **Settings -> Data -> Sync now**.

---

## Build Verification

```bash
# Lint check
npm run lint

# Build production bundle & PWA service worker
npm run build

# Validate Worker bundle
cd worker
npx wrangler deploy --dry-run
```
