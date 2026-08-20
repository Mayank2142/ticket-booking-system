import nodemailer from "nodemailer";
import { bookingQrDataUrl } from "./qr";

async function getTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendTicketEmail(opts: {
  to: string;
  name: string;
  eventTitle: string;
  bookingRef: string;
  seats: string[];
}) {
  const qr = await bookingQrDataUrl(opts.bookingRef);
  const from = process.env.SMTP_FROM ?? "tickets@example.com";
  const subject = `Ticket confirmed: ${opts.eventTitle}`;
  const text = `Hi ${opts.name},\n\nBooking ${opts.bookingRef} for ${opts.eventTitle}.\nSeats: ${opts.seats.join(", ")}`;

  const transport = await getTransport();
  if (!transport) {
    console.log("[email:fallback]", { to: opts.to, subject, bookingRef: opts.bookingRef });
    return;
  }

  await transport.sendMail({
    from,
    to: opts.to,
    subject,
    text,
    attachments: [{ filename: "ticket.png", content: qr.split(",")[1], encoding: "base64" }],
  });
}

export async function sendWaitlistOfferEmail(opts: {
  to: string;
  name: string;
  eventTitle: string;
  category: string;
  offerUrl: string;
  expiresAt: Date;
}) {
  const from = process.env.SMTP_FROM ?? "tickets@example.com";
  const subject = `Seat available: ${opts.eventTitle}`;
  const text = `Hi ${opts.name},\n\nA ${opts.category} seat opened for ${opts.eventTitle}.\nBook before ${opts.expiresAt.toISOString()}:\n${opts.offerUrl}`;

  const transport = await getTransport();
  if (!transport) {
    console.log("[email:fallback]", { to: opts.to, subject, offerUrl: opts.offerUrl });
    return;
  }

  await transport.sendMail({ from, to: opts.to, subject, text });
}
