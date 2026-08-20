"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";

type Booking = {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  event: { title: string; date: string; time: string; venue: { name: string } };
  seats: { seat: { label: string } }[];
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ bookings: Booking[] }>("/api/bookings");
    setBookings(data.bookings);
  }

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  async function cancel(id: string) {
    try {
      await api(`/api/bookings/${id}`, { method: "DELETE" });
      setMessage("Booking cancelled.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
    <AuthGate roles={["CUSTOMER"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        {message && <p className="message">{message}</p>}
        {bookings.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-medium">{b.event.title}</h2>
                <p className="text-sm muted">
                  {b.ref} · {b.event.date} · {b.event.time} · {b.event.venue.name}
                </p>
                <p className="text-sm muted">Seats: {b.seats.map((s) => s.seat.label).join(", ")}</p>
                <p className="text-sm">₹{b.totalAmount} · {b.status}</p>
              </div>
              {b.status === "CONFIRMED" && (
                <button onClick={() => cancel(b.id)} className="btn shrink-0 text-xs">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AuthGate>
  );
}
