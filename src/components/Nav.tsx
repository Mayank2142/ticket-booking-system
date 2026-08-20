"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, clearToken, getToken, User } from "@/lib/client";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => clearToken());
  }, []);

  return (
    <header className="border-b border-white/10 bg-[#0f0f0f]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-white">
          TicketBook
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/" className="nav-link">Events</Link>
          {user && <Link href="/bookings" className="nav-link">Bookings</Link>}
          {user?.role === "ADMIN" && <Link href="/admin/venues" className="nav-link">Venues</Link>}
          {user?.role === "ORGANISER" && <Link href="/organiser/events" className="nav-link">Organiser</Link>}
          {user ? (
            <button
              onClick={() => {
                clearToken();
                setUser(null);
                window.location.href = "/";
              }}
              className="btn ml-2"
            >
              {user.name}
            </button>
          ) : (
            <>
              <Link href="/login" className="nav-link">Login</Link>
              <Link href="/register" className="btn btn-primary ml-1">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
