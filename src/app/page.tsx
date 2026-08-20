"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Event = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  venue: { name: string };
  organiser: { name: string };
};

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    api<{ events: Event[] }>(`/api/events?${params}`)
      .then((d) => setEvents(d.events))
      .catch(console.error);
  }, [type, q]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming events</h1>
        <p className="mt-1 text-sm muted">Browse movies and concerts. Pick seats. Get QR tickets by email.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Search events"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="MOVIE">Movies</option>
          <option value="CONCERT">Concerts</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`} className="card block p-5">
            <p className="label">{event.type}</p>
            <h2 className="mt-1 text-lg font-medium">{event.title}</h2>
            <p className="mt-2 text-sm muted">
              {event.date} · {event.time} · {event.venue.name}
            </p>
            <p className="mt-1 text-xs muted">by {event.organiser.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
