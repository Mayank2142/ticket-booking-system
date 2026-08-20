import { NextRequest } from "next/server";
import { Role, SeatStatus, WaitlistStatus } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  const entries = await db.waitlistEntry.findMany({
    where: { eventId: params.id, userId: user!.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return ok({ entries });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  const { categoryId } = await req.json();
  if (!categoryId) return err("Category required");

  const available = await db.showSeat.count({
    where: {
      eventId: params.id,
      seat: { categoryId },
      status: SeatStatus.AVAILABLE,
    },
  });
  if (available > 0) return err("Seats still available in this category");

  const existing = await db.waitlistEntry.findUnique({
    where: { eventId_categoryId_userId: { eventId: params.id, categoryId, userId: user!.id } },
  });
  if (existing && existing.status !== WaitlistStatus.EXPIRED) {
    return err("Already on waitlist", 409);
  }

  const last = await db.waitlistEntry.findFirst({
    where: { eventId: params.id, categoryId },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? 0) + 1;

  const entry = await db.waitlistEntry.upsert({
    where: { eventId_categoryId_userId: { eventId: params.id, categoryId, userId: user!.id } },
    create: { eventId: params.id, categoryId, userId: user!.id, position, status: WaitlistStatus.WAITING },
    update: {
      position,
      status: WaitlistStatus.WAITING,
      offerToken: null,
      offerExpiresAt: null,
      offeredSeatId: null,
    },
  });

  return ok({ entry }, 201);
}
