import { Suspense } from "react";
import EventClient from "./EventClient";

export default function EventPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <EventClient />
    </Suspense>
  );
}
