"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";

type Event = { id: string; title: string; date: string; time: string; venue: { name: string } };

export default function OrganiserEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    api<{ events: Event[] }>("/api/events?mine=true").then((d) => setEvents(d.events));
  }, []);

  return (
    <AuthGate roles={["ORGANISER", "ADMIN"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">My events</h1>
          <Link href="/organiser/events/new" className="btn btn-primary">New event</Link>
        </div>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="card flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-sm muted">{e.date} · {e.time} · {e.venue.name}</div>
              </div>
              <Link href={`/organiser/events/${e.id}`} className="btn text-xs">
                Summary
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AuthGate>
  );
}
