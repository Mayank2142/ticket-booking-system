"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SeatMap } from "@/components/SeatMap";
import { api, getToken } from "@/lib/client";

type ShowSeat = {
  seatId: string;
  status: string;
  heldById?: string | null;
  seat: { label: string; row: number; col: number; categoryId: string; category: { name: string; color: string } };
};

type OfferInfo = {
  seatId: string | null;
  seatLabel: string | null;
  categoryName: string;
  expiresAt: string | null;
  requiresLogin?: boolean;
};

export default function EventClient() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const offerToken = searchParams.get("offer");
  const [event, setEvent] = useState<{
    title: string;
    date: string;
    time: string;
    prices: { categoryId: string; price: number; category: { name: string } }[];
  } | null>(null);
  const [showSeats, setShowSeats] = useState<ShowSeat[]>([]);
  const [layout, setLayout] = useState<{ rows: number; cols: number } | null>(null);
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);
  const [offer, setOffer] = useState<OfferInfo | null>(null);

  const loadSeats = useCallback(async () => {
    const data = await api<{
      showSeats: ShowSeat[];
      layout: { rows: number; cols: number };
      availability: Record<string, number>;
    }>(`/api/events/${id}/seats`);
    setShowSeats(data.showSeats);
    setLayout(data.layout);
    setAvailability(data.availability ?? {});
  }, [id]);

  useEffect(() => {
    api<{ event: typeof event }>(`/api/events/${id}`).then((d) => setEvent(d.event)).catch(console.error);
    if (getToken()) {
      api<{ user: { id: string; name: string; email: string } }>("/api/auth/me")
        .then((d) => {
          setUserId(d.user.id);
          setCustomer({ name: d.user.name, email: d.user.email });
        })
        .catch(() => null);
    }
    loadSeats();
    const timer = setInterval(loadSeats, 3000);
    return () => clearInterval(timer);
  }, [id, loadSeats]);

  useEffect(() => {
    if (!offerToken) return;
    api<{ offer: OfferInfo; requiresLogin?: boolean }>(
      `/api/events/${id}/waitlist/offer?token=${offerToken}`
    )
      .then((d) => {
        setOffer(d.offer);
        if (d.offer.seatId) setSelected([d.offer.seatId]);
        setMessage(
          d.requiresLogin
            ? `Waitlist offer for ${d.offer.seatLabel ?? "a seat"} — log in to complete booking.`
            : `Waitlist offer: ${d.offer.seatLabel} (${d.offer.categoryName}). Expires ${d.offer.expiresAt ? new Date(d.offer.expiresAt).toLocaleString() : "soon"}.`
        );
      })
      .catch((e) => setMessage(e.message));
  }, [id, offerToken]);

  function toggleSeat(seatId: string, status: string) {
    if (status === "BOOKED") return;
    if (offer?.seatId && seatId !== offer.seatId) return;
    setSelected((prev) => (prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId]));
  }

  async function holdSeats() {
    if (!getToken()) return router.push(`/login?next=/events/${id}?offer=${offerToken ?? ""}`);
    try {
      const res = await api<{ heldUntil: string }>(`/api/events/${id}/seats`, {
        method: "POST",
        body: JSON.stringify({ seatIds: selected, offerToken }),
      });
      setMessage(`Seats held until ${new Date(res.heldUntil).toLocaleTimeString()}`);
      await loadSeats();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Hold failed");
    }
  }

  async function bookSeats() {
    if (!getToken()) return router.push(`/login?next=/events/${id}?offer=${offerToken ?? ""}`);
    try {
      const res = await api<{ booking: { ref: string } }>(`/api/events/${id}/book`, {
        method: "POST",
        body: JSON.stringify({ seatIds: selected, offerToken }),
      });
      setMessage(`Booked! Ref ${res.booking.ref}. Check your email for the QR ticket.`);
      setSelected([]);
      setOffer(null);
      await loadSeats();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Booking failed");
    }
  }

  async function joinWaitlist(categoryId: string) {
    if (!getToken()) return router.push("/login");
    try {
      await api(`/api/events/${id}/waitlist`, { method: "POST", body: JSON.stringify({ categoryId }) });
      setMessage("Added to waitlist for this category.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Waitlist failed");
    }
  }

  if (!event || !layout) return <p className="muted text-sm">Loading...</p>;

  const seatCells = showSeats.map((s) => ({
    seatId: s.seatId,
    label: s.seat.label,
    row: s.seat.row,
    col: s.seat.col,
    status: s.status as "AVAILABLE" | "HELD" | "BOOKED",
    category: s.seat.category,
    heldByMe: s.heldById === userId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="mt-1 text-sm muted">{event.date} · {event.time}</p>
      </div>

      {offer && (
        <div className="message">
          Waitlist offer — seat {offer.seatLabel} ({offer.categoryName}).
          {offer.expiresAt && ` Complete before ${new Date(offer.expiresAt).toLocaleString()}.`}
        </div>
      )}

      <SeatMap rows={layout.rows} cols={layout.cols} seats={seatCells} selected={selected} onToggle={toggleSeat} />

      {selected.length > 0 && (
        <button onClick={holdSeats} className="btn">Hold seats</button>
      )}

      {selected.length > 0 && (
        <div className="card space-y-4 p-5">
          <h2 className="font-medium">Checkout</h2>
          <p className="text-sm muted">
            Seats: {selected.map((sid) => seatCells.find((s) => s.seatId === sid)?.label).filter(Boolean).join(", ")}
          </p>
          {customer ? (
            <div className="space-y-1 text-sm">
              <p><span className="muted">Name</span> · {customer.name}</p>
              <p><span className="muted">Email</span> · {customer.email}</p>
              <p className="text-xs muted">QR ticket will be sent to this email.</p>
            </div>
          ) : (
            <p className="text-sm muted">Log in to complete booking.</p>
          )}
          <button
            onClick={bookSeats}
            disabled={!selected.length || !customer}
            className="btn btn-primary"
          >
            Confirm booking
          </button>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-medium">Pricing & waitlist</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {event.prices.map((p) => {
            const seatsLeft = availability[p.categoryId] ?? 0;
            return (
              <li key={p.categoryId} className="flex items-center justify-between gap-4">
                <span className="muted">
                  {p.category.name} · ₹{p.price}
                  {seatsLeft > 0 ? ` · ${seatsLeft} left` : " · sold out"}
                </span>
                {seatsLeft === 0 && (
                  <button onClick={() => joinWaitlist(p.categoryId)} className="btn text-xs">
                    Join waitlist
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {message && <p className="message">{message}</p>}
    </div>
  );
}
