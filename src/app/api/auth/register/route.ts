import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { err, ok } from "@/lib/api";
import { hashPassword, signToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role } = body as {
    email?: string;
    password?: string;
    name?: string;
    role?: Role;
  };

  if (!email || !password || !name) return err("Missing fields");

  const allowed: Role[] = [Role.CUSTOMER, Role.ORGANISER];
  const userRole = role && allowed.includes(role) ? role : Role.CUSTOMER;

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return err("Email already registered", 409);

  const user = await db.user.create({
    data: { email, name, password: await hashPassword(password), role: userRole },
  });

  const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return ok({ token: signToken(authUser), user: authUser }, 201);
}
