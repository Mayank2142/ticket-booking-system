import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const event = await db.event.findUnique({
    where: { id: params.id },
    include: {
      venue: { include: { categories: true } },
      prices: { include: { category: true } },
      organiser: { select: { name: true } },
    },
  });
  if (!event) return err("Not found", 404);
  return ok({ event });
}
