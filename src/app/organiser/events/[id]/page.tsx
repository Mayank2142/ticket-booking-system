"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";

type Summary = {
  event: { title: string; date: string; time: string };
  totalBookings: number;
  revenue: number;
  byCategory: { category: string; booked: number; price: number }[];
};

export default function OrganiserSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>(`/api/organiser/events/${id}/summary`).then(setSummary).catch(console.error);
  }, [id]);

  if (!summary) return <p className="muted text-sm">Loading...</p>;

  return (
    <AuthGate roles={["ORGANISER", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{summary.event.title}</h1>
          <p className="mt-1 text-sm muted">{summary.event.date} · {summary.event.time}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-5">
            <p className="label">Total bookings</p>
            <p className="mt-1 text-3xl font-semibold">{summary.totalBookings}</p>
          </div>
          <div className="card p-5">
            <p className="label">Revenue</p>
            <p className="mt-1 text-3xl font-semibold">₹{summary.revenue}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="p-4 font-medium muted">Category</th>
                <th className="p-4 font-medium muted">Booked</th>
                <th className="p-4 font-medium muted">Price</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={row.category} className="border-b border-white/10">
                  <td className="p-4">{row.category}</td>
                  <td className="p-4 muted">{row.booked}</td>
                  <td className="p-4">₹{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGate>
  );
}
