import { randomBytes } from "crypto";
import { HOLD_TTL_MINUTES, WAITLIST_OFFER_MINUTES } from "./constants";
import { sendWaitlistOfferEmail } from "./email";
import { db } from "./db";
import { SeatStatus, WaitlistStatus } from "@/generated/prisma/client";

export async function releaseExpiredHolds(eventId?: string) {
  const now = new Date();
  await db.showSeat.updateMany({
    where: {
      status: SeatStatus.HELD,
      heldUntil: { lt: now },
      ...(eventId ? { eventId } : {}),
    },
    data: {
      status: SeatStatus.AVAILABLE,
      heldUntil: null,
      heldById: null,
      version: { increment: 1 },
    },
  });
}

export async function getWaitlistOffer(token: string, userId?: string) {
  const entry = await db.waitlistEntry.findUnique({
    where: { offerToken: token },
    include: {
      category: true,
      event: { select: { title: true } },
      user: { select: { id: true, name: true } },
    },
  });
  if (!entry || entry.status !== WaitlistStatus.OFFERED) return null;
  if (entry.offerExpiresAt && entry.offerExpiresAt < new Date()) return null;
  if (userId && entry.userId !== userId) return null;

  let seatLabel: string | null = null;
  if (entry.offeredSeatId) {
    const showSeat = await db.showSeat.findFirst({
      where: { eventId: entry.eventId, seatId: entry.offeredSeatId },
      include: { seat: true },
    });
    seatLabel = showSeat?.seat.label ?? null;
  }

  return {
    eventId: entry.eventId,
    categoryId: entry.categoryId,
    categoryName: entry.category.name,
    eventTitle: entry.event.title,
    seatId: entry.offeredSeatId,
    seatLabel,
    expiresAt: entry.offerExpiresAt,
    userId: entry.userId,
  };
}

export async function holdSeats(
  eventId: string,
  seatIds: string[],
  userId: string,
  offerToken?: string
) {
  await expireStaleOffers(eventId);
  await releaseExpiredHolds(eventId);

  if (offerToken) {
    const offer = await getWaitlistOffer(offerToken, userId);
    if (!offer) throw new Error("Invalid or expired waitlist offer");
    if (!offer.seatId || !seatIds.includes(offer.seatId)) {
      throw new Error("You must hold the seat from your waitlist offer");
    }
  }

  const heldUntil = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000);

  return db.$transaction(async (tx) => {
    const seats = await tx.showSeat.findMany({
      where: { eventId, seatId: { in: seatIds } },
      include: { seat: true },
    });

    if (seats.length !== seatIds.length) throw new Error("Invalid seats");

    for (const seat of seats) {
      const available =
        seat.status === SeatStatus.AVAILABLE ||
        (seat.status === SeatStatus.HELD && seat.heldById === userId);
      if (!available) throw new Error(`Seat ${seat.seat.label} unavailable`);
    }

    for (const seat of seats) {
      const updated = await tx.showSeat.updateMany({
        where: {
          id: seat.id,
          OR: [
            { status: SeatStatus.AVAILABLE },
            { status: SeatStatus.HELD, heldById: userId },
          ],
        },
        data: {
          status: SeatStatus.HELD,
          heldById: userId,
          heldUntil,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("Seat taken by another customer");
    }

    return { heldUntil };
  });
}

function bookingRef() {
  return `BK-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function confirmBooking(
  eventId: string,
  seatIds: string[],
  userId: string,
  offerToken?: string
) {
  await expireStaleOffers(eventId);
  await releaseExpiredHolds(eventId);

  let waitlistEntryId: string | null = null;
  if (offerToken) {
    const offer = await getWaitlistOffer(offerToken, userId);
    if (!offer) throw new Error("Invalid or expired waitlist offer");
    if (!offer.seatId || !seatIds.includes(offer.seatId)) {
      throw new Error("Book the seat from your waitlist offer");
    }
    const entry = await db.waitlistEntry.findUnique({ where: { offerToken } });
    waitlistEntryId = entry?.id ?? null;
  }

  const booking = await db.$transaction(async (tx) => {
    const showSeats = await tx.showSeat.findMany({
      where: { eventId, seatId: { in: seatIds } },
      include: { seat: { include: { category: true } } },
    });

    if (showSeats.length !== seatIds.length) throw new Error("Invalid seats");

    for (const seat of showSeats) {
      if (seat.status !== SeatStatus.HELD || seat.heldById !== userId) {
        throw new Error(`Seat ${seat.seat.label} not held by you`);
      }
    }

    const prices = await tx.categoryPrice.findMany({ where: { eventId } });
    const priceMap = new Map(prices.map((p) => [p.categoryId, p.price]));
    const totalAmount = showSeats.reduce(
      (sum, s) => sum + (priceMap.get(s.seat.categoryId) ?? 0),
      0
    );

    for (const seat of showSeats) {
      const updated = await tx.showSeat.updateMany({
        where: { id: seat.id, status: SeatStatus.HELD, heldById: userId },
        data: {
          status: SeatStatus.BOOKED,
          heldUntil: null,
          heldById: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("Booking conflict");
    }

    const ref = bookingRef();
    return tx.booking.create({
      data: {
        userId,
        eventId,
        ref,
        totalAmount,
        seats: { create: seatIds.map((seatId) => ({ seatId })) },
      },
      include: { seats: { include: { seat: true } }, event: true, user: true },
    });
  });

  if (waitlistEntryId) {
    await db.waitlistEntry.update({
      where: { id: waitlistEntryId },
      data: {
        status: WaitlistStatus.FULFILLED,
        offerToken: null,
        offerExpiresAt: null,
        offeredSeatId: null,
      },
    });
  }

  return booking;
}

export async function offerNextWaitlistForSeat(eventId: string, seatId: string) {
  const seat = await db.seat.findUnique({ where: { id: seatId } });
  if (!seat) return null;

  const next = await db.waitlistEntry.findFirst({
    where: { eventId, categoryId: seat.categoryId, status: WaitlistStatus.WAITING },
    orderBy: { position: "asc" },
    include: { user: true, event: true, category: true },
  });
  if (!next) return null;

  const token = randomBytes(16).toString("hex");
  const offerExpiresAt = new Date(Date.now() + WAITLIST_OFFER_MINUTES * 60_000);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  await db.$transaction(async (tx) => {
    const showSeat = await tx.showSeat.findFirst({ where: { eventId, seatId } });
    if (!showSeat || showSeat.status !== SeatStatus.AVAILABLE) {
      throw new Error("Seat not available for waitlist offer");
    }

    await tx.showSeat.updateMany({
      where: { id: showSeat.id, status: SeatStatus.AVAILABLE },
      data: {
        status: SeatStatus.HELD,
        heldById: next.userId,
        heldUntil: offerExpiresAt,
        version: { increment: 1 },
      },
    });

    await tx.waitlistEntry.update({
      where: { id: next.id },
      data: {
        status: WaitlistStatus.OFFERED,
        offerToken: token,
        offerExpiresAt,
        offeredSeatId: seatId,
      },
    });
  });

  const offerUrl = `${appUrl}/events/${eventId}?offer=${token}`;
  await sendWaitlistOfferEmail({
    to: next.user.email,
    name: next.user.name,
    eventTitle: next.event.title,
    category: next.category.name,
    offerUrl,
    expiresAt: offerExpiresAt,
  });

  return { token, offerExpiresAt, seatId };
}

export async function expireStaleOffers(eventId?: string) {
  const now = new Date();
  const stale = await db.waitlistEntry.findMany({
    where: {
      status: WaitlistStatus.OFFERED,
      offerExpiresAt: { lt: now },
      ...(eventId ? { eventId } : {}),
    },
  });

  for (const entry of stale) {
    const seatId = entry.offeredSeatId;
    await db.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: WaitlistStatus.EXPIRED,
        offerToken: null,
        offerExpiresAt: null,
        offeredSeatId: null,
      },
    });

    if (seatId) {
      await db.showSeat.updateMany({
        where: { eventId: entry.eventId, seatId, status: SeatStatus.HELD, heldById: entry.userId },
        data: {
          status: SeatStatus.AVAILABLE,
          heldUntil: null,
          heldById: null,
          version: { increment: 1 },
        },
      });
      await offerNextWaitlistForSeat(entry.eventId, seatId);
    }
  }
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { seats: { include: { seat: true } } },
  });
  if (!booking || booking.userId !== userId) throw new Error("Booking not found");
  if (booking.status !== "CONFIRMED") throw new Error("Already cancelled");

  const freedSeats = booking.seats.map((s) => s.seatId);

  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    for (const seatId of freedSeats) {
      await tx.showSeat.updateMany({
        where: { eventId: booking.eventId, seatId },
        data: {
          status: SeatStatus.AVAILABLE,
          heldUntil: null,
          heldById: null,
          version: { increment: 1 },
        },
      });
    }
  });

  for (const seatId of freedSeats) {
    await offerNextWaitlistForSeat(booking.eventId, seatId);
  }
}

export async function categoryAvailability(eventId: string, categoryId: string) {
  const available = await db.showSeat.count({
    where: { eventId, seat: { categoryId }, status: SeatStatus.AVAILABLE },
  });
  return available;
}
