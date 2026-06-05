import Link from "next/link";
import { getEventAvailability } from "@/lib/event-utils";
import { labels } from "@/lib/labels";
import type { Event } from "@/lib/types";
import { EventStatusBadge } from "./event-status-badge";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const availability = getEventAvailability(event);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            {event.category}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-zinc-900">{event.title}</h3>
        </div>
        <EventStatusBadge status={availability.status} variant="public" />
      </div>

      <p className="mt-4 text-sm text-zinc-600">{event.description}</p>

      <dl className="mt-5 space-y-2 text-sm text-zinc-700">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">{labels.date}</dt>
          <dd>{event.date}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">{labels.location}</dt>
          <dd>{event.location}</dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {event.type === "Paid" ? labels.paid : labels.free}
        </span>
        <Link
          href={`/events/${event.slug}`}
          className="rounded-lg bg-[var(--accent-button)] px-3.5 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)]"
        >
          {labels.viewDetails}
        </Link>
      </div>
    </article>
  );
}
