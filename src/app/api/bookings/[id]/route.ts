import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { cancelBooking } from "@/lib/seats";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(_req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  try {
    await cancelBooking(params.id, user!.id);
    return ok({ cancelled: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Cancel failed", 400);
  }
}
