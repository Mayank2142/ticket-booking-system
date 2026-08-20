"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/client";

export function AuthGate({
  roles,
  children,
}: {
  roles?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<{ user: { role: string } }>("/api/auth/me")
      .then((d) => {
        if (roles && !roles.includes(d.user.role)) router.replace("/");
        else setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router, roles]);

  if (!ready) return <p className="muted text-sm">Checking access...</p>;
  return <>{children}</>;
}
