import { NextRequest } from "next/server";
import { EventType, Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const mine = searchParams.get("mine") === "true";

  const events = await db.event.findMany({
    where: {
      ...(type ? { type: type as EventType } : {}),
      ...(q ? { title: { contains: q } } : {}),
      ...(mine && user?.role === Role.ORGANISER ? { organiserId: user.id } : {}),
    },
    include: {
      venue: true,
      organiser: { select: { name: true } },
      prices: { include: { category: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return ok({ events });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.ORGANISER, Role.ADMIN])) return err("Forbidden", 403);

  const body = await req.json();
  const { title, type, description, venueId, date, time, prices } = body as {
    title?: string;
    type?: EventType;
    description?: string;
    venueId?: string;
    date?: string;
    time?: string;
    prices?: { categoryId: string; price: number }[];
  };

  if (!title || !type || !venueId || !date || !time || !prices?.length) {
    return err("Missing fields");
  }

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    include: { seats: true, categories: true },
  });
  if (!venue) return err("Venue not found", 404);

  const event = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title,
        type,
        description,
        venueId,
        date,
        time,
        organiserId: user!.id,
        prices: { create: prices },
      },
    });

    await tx.showSeat.createMany({
      data: venue.seats.map((seat) => ({ eventId: created.id, seatId: seat.id })),
    });

    return created;
  });

  const full = await db.event.findUnique({
    where: { id: event.id },
    include: { venue: true, prices: { include: { category: true } } },
  });

  return ok({ event: full }, 201);
}
