# Allo Inventory — Reservation System

A Next.js application implementing race-condition-safe inventory reservations for multi-warehouse retail.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Prisma** — ORM
- **Neon** — Serverless Postgres
- **Upstash Redis** — Idempotency key storage
- **Tailwind CSS** — Styling
- **Vercel** — Deployment + Cron Jobs

## Running Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://...@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
CRON_SECRET=any_random_string
RESERVATION_TTL_MINUTES=10
```

> `DATABASE_URL` uses Neon's **pooled** connection string (has `-pooler` in the hostname).  
> `DIRECT_URL` uses the **direct** (non-pooled) string — required for Prisma migrations.

### 3. Run migrations and seed
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Create reservation (409 if insufficient stock) |
| GET | `/api/reservations/:id` | Get reservation details |
| POST | `/api/reservations/:id/confirm` | Confirm reservation (410 if expired) |
| POST | `/api/reservations/:id/release` | Release reservation early |

---

## Concurrency Strategy

The reserve endpoint uses **Postgres advisory locks** (`pg_advisory_xact_lock`) to prevent race conditions:

1. A numeric lock key is derived from the `Stock` row ID.
2. Inside a Prisma transaction, the lock is acquired — concurrent requests for the same stock row queue behind the first.
3. Available stock is computed inside the lock: `available = total - active_pending_reservations`.
4. If `available < requested`, a 409 is returned. Otherwise the reservation is created atomically.

This means two simultaneous requests for the last unit will resolve correctly — exactly one succeeds.

---

## Expiry Mechanism

Reservations expire 10 minutes after creation (configurable via `RESERVATION_TTL_MINUTES`).

**In production:** A Vercel Cron Job hits `GET /api/cron/expire-reservations` every minute. It finds all `PENDING` reservations where `expiresAt < now` and bulk-updates them to `RELEASED`. The route is protected with a `CRON_SECRET` checked against the `Authorization` header.

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }]
}
```

Available stock shown to users is always computed against active (non-expired) pending reservations, so even if the cron hasn't run yet, the numbers stay accurate.

---

## Idempotency (Bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header.

- On first request: the response is stored in the `IdempotencyRecord` table with a TTL-like key.
- On retry with the same key: the stored response is returned immediately — no duplicate reservation is created.
- Keys are scoped per endpoint: `POST:reservations:{key}` and `POST:reservations:{id}:confirm:{key}`.

---

## Trade-offs & What I'd Do Differently

**Deliberate simplifications:**
- No authentication — in production, reservations would be tied to a user session.
- Stock counts are computed via aggregate queries rather than a denormalized `reserved` column — simpler to reason about correctness, slightly slower at scale.
- No rate limiting on the reservation endpoint.

**With more time:**
- End-to-end concurrency tests with Playwright (two simultaneous reserve requests, assert one 201 + one 409).
- WebSocket/SSE so product listings update in real time when stock changes.
- Proper observability — structured logging and error tracking (Sentry).
- Move the advisory lock key derivation to a proper integer hash to avoid edge-case overflow.
