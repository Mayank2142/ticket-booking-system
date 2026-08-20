import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function getToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies.get("token")?.value ?? null;
}

export async function getUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { sub: string };
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch {
    return null;
  }
}

export function requireRole(user: AuthUser | null, roles: Role[]) {
  return !!user && roles.includes(user.role);
}
