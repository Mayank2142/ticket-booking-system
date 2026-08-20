# Ticket Booking System

Movie and concert ticket booking with visual seat maps, timed holds, waitlists, and QR email tickets.

- **Repository:** https://github.com/Mayank2142/ticket-booking-system
- **Branch:** `main` (public)

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | password123 |
| Organiser | organiser@demo.com | password123 |
| Customer | customer@demo.com | password123 |

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite path, e.g. `file:./dev.db` |
| `JWT_SECRET` | Signs auth tokens |
| `SEAT_HOLD_TTL_MINUTES` | Checkout hold duration (default 10) |
| `WAITLIST_OFFER_TTL_MINUTES` | Waitlist offer window (default 15) |
| `CRON_SECRET` | Protects `/api/cron/release-holds` |
| `APP_URL` | Base URL for waitlist offer email links |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Optional — emails log to console if unset |

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register (customer or organiser) |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Current user profile |
| GET | `/api/venues` | — | List venues |
| POST | `/api/venues` | Admin | Create venue with seat layout |
| GET | `/api/events` | — | Browse events (`?type=MOVIE&q=search`) |
| GET | `/api/events?mine=true` | Organiser | List own events only |
| POST | `/api/events` | Organiser | Create event with pricing |
| GET | `/api/events/:id` | — | Event details |
| GET | `/api/events/:id/seats` | — | Seat map + availability |
| POST | `/api/events/:id/seats` | Customer | Hold seats (`seatIds`, optional `offerToken`) |
| POST | `/api/events/:id/book` | Customer | Confirm booking + QR email |
| GET | `/api/events/:id/waitlist` | Customer | My waitlist entries for event |
| POST | `/api/events/:id/waitlist` | Customer | Join category waitlist |
| GET | `/api/events/:id/waitlist/offer?token=` | Optional | Validate waitlist offer |
| GET | `/api/bookings` | Customer | Booking history |
| DELETE | `/api/bookings/:id` | Customer | Cancel booking |
| GET | `/api/organiser/events/:id/summary` | Organiser | Bookings + revenue |
| GET/POST | `/api/cron/release-holds` | `x-cron-secret` or Bearer | Expire holds and offers |

## Database schema

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String | Primary key |
| email | String | Unique |
| password | String | bcrypt hash |
| name | String | Display name |
| role | Enum | ADMIN, ORGANISER, CUSTOMER |

### Venue / SeatCategory / Seat
Venues have a row-by-column grid. Each seat belongs to a category (Premium, Standard) with a colour for the map.

### Event / CategoryPrice
Organisers create events linked to a venue with per-category pricing.

### ShowSeat
Per-event copy of each venue seat with live status: `AVAILABLE`, `HELD`, or `BOOKED`. Holds store `heldUntil`, `heldById`, and a `version` counter for concurrency.

### Booking / BookingSeat
Confirmed bookings have a unique `ref` (used in QR codes), status, total amount, and linked seats.

### WaitlistEntry
Queue per event and category. Fields: `position`, `status` (WAITING/OFFERED/FULFILLED/EXPIRED), `offerToken`, `offerExpiresAt`, `offeredSeatId`.

Full Prisma schema: `prisma/schema.prisma`

## Seat hold logic

1. Customer selects seats on the visual map and clicks **Hold seats**.
2. `POST /seats` sets each seat to `HELD` with `heldUntil = now + TTL`.
3. Other customers see held seats as unavailable (map polls every 3 seconds).
4. Customer reviews details and clicks **Confirm booking**.
5. Expired holds release on seat-map fetch and via cron every minute.
6. Conditional DB updates prevent two customers holding the same seat.

## Waitlist logic

1. Sold-out category: customer joins waitlist queue.
2. On cancellation: seat held for next waiter, email with time-limited link.
3. Customer books via offer link with token validation.
4. Expired offers cascade to the next person automatically.

## Assignment deliverables

| Item | Location |
|------|----------|
| Source code | GitHub repo (branch `main`) |
| Setup guide + API docs + DB schema | This README |
| Environment template | `.env.example` |
| System design (800 words max) | `SYSTEM_DESIGN.md` |
| Hosted URL | Deploy section below |

## Deploy

**Railway (recommended):** persistent SQLite, import repo, set env vars, build `npm run build && npm run db:deploy`, start `npm start`. Schedule cron to hit `/api/cron/release-holds` every minute.

**Vercel:** `vercel.json` includes cron. Set `CRON_SECRET` in env. SQLite is ephemeral on Vercel — use Railway for a persistent demo.

## Hosted URL

Add your live deployment URL after publishing:

`https://your-app.up.railway.app`
