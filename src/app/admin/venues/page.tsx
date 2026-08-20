"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";

type Venue = { id: string; name: string; rows: number; cols: number; _count: { events: number } };

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ venues: Venue[] }>("/api/venues");
    setVenues(data.venues);
  }

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const rows = Number(form.get("rows"));
    const cols = Number(form.get("cols"));
    const premiumRows = (form.get("premiumRows") as string).split(",").map(Number);
    const standardRows = (form.get("standardRows") as string).split(",").map(Number);

    try {
      await api("/api/venues", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          rows,
          cols,
          categories: [
            { name: "Premium", color: "#ffffff", rows: premiumRows },
            { name: "Standard", color: "#888888", rows: standardRows },
          ],
        }),
      });
      setMessage("Venue created");
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <AuthGate roles={["ADMIN"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Manage venues</h1>
        <form onSubmit={onSubmit} className="card grid max-w-lg gap-3 p-5">
          <input name="name" required placeholder="Venue name" className="input w-full" />
          <input name="rows" type="number" required placeholder="Total rows" className="input w-full" />
          <input name="cols" type="number" required placeholder="Total cols" className="input w-full" />
          <input name="premiumRows" placeholder="Premium rows e.g. 1,2" className="input w-full" />
          <input name="standardRows" placeholder="Standard rows e.g. 3,4,5" className="input w-full" />
          <button type="submit" className="btn btn-primary">Create venue</button>
        </form>
        {message && <p className="message">{message}</p>}
        <ul className="space-y-2">
          {venues.map((v) => (
            <li key={v.id} className="card p-4 text-sm muted">
              {v.name} · {v.rows}×{v.cols} · {v._count.events} events
            </li>
          ))}
        </ul>
      </div>
    </AuthGate>
  );
}
