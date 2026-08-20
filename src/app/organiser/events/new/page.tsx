"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";

type Venue = {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
};

export default function NewEventPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ venues: Venue[] }>("/api/venues").then((d) => setVenues(d.venues));
  }, []);

  const venue = venues.find((v) => v.id === venueId);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!venue) return;

    try {
      const data = await api<{ event: { id: string } }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          type: form.get("type"),
          description: form.get("description"),
          venueId,
          date: form.get("date"),
          time: form.get("time"),
          prices: venue.categories.map((c) => ({
            categoryId: c.id,
            price: Number(prices[c.id] ?? 0),
          })),
        }),
      });
      router.push(`/organiser/events/${data.event.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <AuthGate roles={["ORGANISER", "ADMIN"]}>
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create event</h1>
        <form onSubmit={onSubmit} className="card space-y-3 p-5">
          <input name="title" required placeholder="Title" className="input w-full" />
          <select name="type" className="input w-full">
            <option value="CONCERT">Concert</option>
            <option value="MOVIE">Movie</option>
          </select>
          <textarea name="description" placeholder="Description" className="input w-full min-h-[80px] rounded-2xl" />
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            required
            className="input w-full"
          >
            <option value="">Select venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input name="date" type="date" required className="input w-full" />
          <input name="time" type="time" required className="input w-full" />
          {venue?.categories.map((c) => (
            <input
              key={c.id}
              type="number"
              required
              placeholder={`${c.name} price`}
              className="input w-full"
              onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))}
            />
          ))}
          {message && <p className="text-sm muted">{message}</p>}
          <button type="submit" className="btn btn-primary w-full">Create</button>
        </form>
      </div>
    </AuthGate>
  );
}
