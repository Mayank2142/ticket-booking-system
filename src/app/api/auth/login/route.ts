import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api";
import { signToken, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return err("Missing fields");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    return err("Invalid credentials", 401);
  }

  const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return ok({ token: signToken(authUser), user: authUser });
}
