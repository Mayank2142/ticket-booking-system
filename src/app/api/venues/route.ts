import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { getUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { seatLabel } from "@/lib/seats-label";

type CategoryInput = { name: string; color?: string; rows: number[] };

export async function GET() {
  const venues = await db.venue.findMany({
    include: { categories: true, seats: true, _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok({ venues });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!requireRole(user, [Role.ADMIN])) return err("Forbidden", 403);

  const { name, rows, cols, categories } = await req.json() as {
    name?: string;
    rows?: number;
    cols?: number;
    categories?: CategoryInput[];
  };

  if (!name || !rows || !cols || !categories?.length) return err("Missing fields");

  const venue = await db.$transaction(async (tx) => {
    const created = await tx.venue.create({ data: { name, rows, cols } });

    for (const cat of categories) {
      const category = await tx.seatCategory.create({
        data: { venueId: created.id, name: cat.name, color: cat.color ?? "#6366f1" },
      });

      for (const row of cat.rows) {
        for (let col = 1; col <= cols; col++) {
          await tx.seat.create({
            data: {
              venueId: created.id,
              categoryId: category.id,
              row,
              col,
              label: seatLabel(row, col),
            },
          });
        }
      }
    }

    return created;
  });

  const full = await db.venue.findUnique({
    where: { id: venue.id },
    include: { categories: true, seats: true },
  });

  return ok({ venue: full }, 201);
}
