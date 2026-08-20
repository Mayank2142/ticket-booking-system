import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api";
import { getUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return err("Unauthorized", 401);
  return ok({ user });
}
