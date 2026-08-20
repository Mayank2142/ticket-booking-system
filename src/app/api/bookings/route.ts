import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  const bookings = await db.booking.findMany({
    where: { userId: user!.id },
    include: {
      event: { include: { venue: true } },
      seats: { include: { seat: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ bookings });
}
