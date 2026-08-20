import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryAvailability, expireStaleOffers, holdSeats, releaseExpiredHolds } from "@/lib/seats";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await expireStaleOffers(params.id);
  await releaseExpiredHolds(params.id);

  const showSeats = await db.showSeat.findMany({
    where: { eventId: params.id },
    include: { seat: { include: { category: true } } },
    orderBy: [{ seat: { row: "asc" } }, { seat: { col: "asc" } }],
  });

  const venue = await db.event.findUnique({
    where: { id: params.id },
    select: { venue: { select: { rows: true, cols: true } } },
  });

  const availability: Record<string, number> = {};
  for (const ss of showSeats) {
    const cid = ss.seat.categoryId;
    if (availability[cid] === undefined) {
      availability[cid] = await categoryAvailability(params.id, cid);
    }
  }

  return ok({ showSeats, layout: venue?.venue, availability });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  const { seatIds, offerToken } = await req.json();
  if (!Array.isArray(seatIds) || !seatIds.length) return err("Select seats");

  try {
    const result = await holdSeats(params.id, seatIds, user!.id, offerToken);
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Hold failed", 409);
  }
}
