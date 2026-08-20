import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { sendTicketEmail } from "@/lib/email";
import { confirmBooking } from "@/lib/seats";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.CUSTOMER])) return err("Forbidden", 403);

  const { seatIds, offerToken } = await req.json();
  if (!Array.isArray(seatIds) || !seatIds.length) return err("Select seats");

  try {
    const booking = await confirmBooking(params.id, seatIds, user!.id, offerToken);
    await sendTicketEmail({
      to: booking.user.email,
      name: booking.user.name,
      eventTitle: booking.event.title,
      bookingRef: booking.ref,
      seats: booking.seats.map((s) => s.seat.label),
    });
    return ok({ booking }, 201);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Booking failed", 409);
  }
}
