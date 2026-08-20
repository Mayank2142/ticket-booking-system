# System Design

## Overview

This ticket booking platform is a full-stack Next.js application backed by SQLite (Prisma ORM). It supports three roles — admin, organiser, and customer — and centres on a per-event seat map where each physical seat has a live status: available, held, or booked. The hardest problems are timed seat holds, concurrent booking safety, and fair waitlist reallocation when cancellations occur.

## Seat hold and TTL mechanism

Each seat at each event is represented by a `ShowSeat` row linking an `eventId` to a `seatId`. Status defaults to `AVAILABLE`. When a customer selects seats and calls `POST /api/events/:id/seats`, the server runs a database transaction:

1. Expire any stale waitlist offers and release holds whose `heldUntil` timestamp is in the past.
2. Verify every requested seat is either `AVAILABLE` or already `HELD` by the same user.
3. Atomically set status to `HELD`, assign `heldById`, and set `heldUntil = now + SEAT_HOLD_TTL_MINUTES` (configurable, default 10 minutes).

Held seats appear amber on the seat map and are disabled for other users. The frontend polls `GET /api/events/:id/seats` every three seconds so all clients see near real-time updates without WebSockets.

If the customer abandons checkout, `heldUntil` passes and the seat is released back to `AVAILABLE`. Release happens in two places: on every seat-map read (lazy expiry) and via a scheduled cron job (`GET/POST /api/cron/release-holds`) that sweeps all expired holds globally. This dual approach ensures seats free up even if nobody is viewing the event page.

Booking (`POST /api/events/:id/book`) only succeeds when every seat is `HELD` by the requesting customer. On success, status becomes `BOOKED` and hold fields are cleared.

## Concurrency prevention

Two customers selecting the same seat at the same time must not both succeed. The system uses optimistic concurrency via conditional `updateMany` inside Prisma transactions:

```text
update ShowSeat SET status='HELD', heldById=?, heldUntil=?
WHERE id=? AND (status='AVAILABLE' OR (status='HELD' AND heldById=?))
```

If `count !== 1`, the transaction fails with "Seat taken by another customer". The same pattern guards the transition from `HELD` to `BOOKED`. A `version` integer increments on every change for auditability. No application-level mutex is needed; the database row state is the lock.

## Waitlist auto-assignment flow

Waitlist entries are scoped per event and seat category, ordered by `position`. A customer can join only when zero seats remain available in that category (`POST /api/events/:id/waitlist`).

When a confirmed booking is cancelled:

1. Each freed seat is set to `AVAILABLE`.
2. `offerNextWaitlistForSeat(eventId, seatId)` finds the next `WAITING` entry for that seat's category.
3. The entry becomes `OFFERED` with a unique `offerToken`, `offerExpiresAt`, and `offeredSeatId`.
4. The seat is immediately held for that customer until the offer expires — no other user can take it.
5. An email is sent with a link: `/events/:id?offer=TOKEN`.

The customer opens the link, the UI validates the token via `GET /api/events/:id/waitlist/offer`, pre-selects the offered seat, and passes `offerToken` on hold/book requests. Successful booking sets the waitlist entry to `FULFILLED`.

## Time-limited offer handling

If the customer does not complete booking before `offerExpiresAt`, `expireStaleOffers` (called on seat-map reads and cron) does the following:

1. Mark the entry `EXPIRED` and clear token fields.
2. Release the seat hold.
3. Call `offerNextWaitlistForSeat` for the same seat so the next person in queue receives a new email.

This cascade continues until the queue is empty or someone books. Offer TTL is configurable via `WAITLIST_OFFER_TTL_MINUTES` (default 15 minutes).

## Seat map data model

Venues define a grid (`rows` × `cols`) with seats assigned to categories (Premium, Standard). When an organiser creates an event, a `ShowSeat` row is created for every venue seat. The frontend renders a CSS grid coloured by category and status. Seat labels use `R{row}C{col}` format.

## QR code and email delivery

On booking confirmation, a unique reference (`BK-XXXXXXXX`) is generated. A QR code PNG encoding this reference is created with the `qrcode` library and attached to a confirmation email via Nodemailer. If SMTP is not configured, the email payload is logged to the console for local development. Free-tier SMTP (Gmail, SendGrid, etc.) works in production.

## Role-based access

JWT tokens carry user id and role. APIs enforce role checks: admin for venues, organiser for event creation and summaries, customer for holds, bookings, and waitlists. Protected frontend pages use an `AuthGate` component that redirects unauthenticated or unauthorised users.

## Deployment notes

SQLite suits local development and single-host deployment with persistent disk (Railway). Serverless platforms with ephemeral filesystem require PostgreSQL or a hosted SQLite service. The cron endpoint must be called every minute in production to guarantee timely hold and offer expiry.
