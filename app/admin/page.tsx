"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { getEventAvailability, sortEventsForAdmin } from "@/lib/event-utils";
import { getRegistrationStatusLabel, labels } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/types";

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  short_description: string | null;
  long_description: string | null;
  category: Event["category"] | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  capacity: number | null;
  is_paid: boolean | null;
  price: number | null;
  waitlist_enabled: boolean | null;
  is_published: boolean | null;
};

type RegistrationCountRow = {
  event_id: string | number | null;
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | null;
};

type SupabaseRegistrationRow = {
  id: string | number;
  client_id: string | number | null;
  event_id: string | number | null;
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | null;
  created_at: string | null;
};

type SupabaseClientRow = {
  id: string | number;
  full_name: string | null;
  email: string | null;
};

type RecentRegistrationView = {
  id: string;
  clientName: string;
  clientEmail: string;
  eventLabel: string;
  status: "confirmed" | "waitlist" | "pending" | "cancelled";
  createdAtLabel: string;
};

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapSupabaseEventToEvent(
  row: SupabaseEventRow,
  index: number,
  countsByEventId: Record<string, { confirmed: number; pending: number; waitlist: number }>,
): Event {
  const safeTitle = row.title?.trim() || "Evento sin título";
  const safeSlug =
    row.slug?.trim() ||
    safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") ||
    `event-${index + 1}`;

  const eventId = String(row.id ?? safeSlug);
  const counts = countsByEventId[eventId] ?? { confirmed: 0, pending: 0, waitlist: 0 };
  const capacity = row.capacity ?? 0;
  const isPaid = row.is_paid ?? (row.price ?? 0) > 0;

  return {
    id: eventId,
    slug: safeSlug,
    title: safeTitle,
    date: row.event_date ?? "TBD",
    time: row.event_time ?? "TBD",
    location: row.location ?? "Ubicación pendiente",
    description: row.short_description ?? row.long_description ?? "Detalles próximamente.",
    category: row.category ?? "Networking",
    type: isPaid ? "Paid" : "Free",
    capacity,
    confirmedCount: counts.confirmed,
    pendingCount: counts.pending,
    waitlistEnabled: row.waitlist_enabled ?? true,
    waitlistCount: counts.waitlist,
    featured: row.is_published ?? false,
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistrationView[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchEvents() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id,title,slug,short_description,long_description,category,event_date,event_time,location,capacity,is_paid,price,waitlist_enabled,is_published",
        );

      if (!isMounted) return;

      if (error) {
        setErrorMessage("No se pudieron cargar los eventos.");
        setEvents([]);
        setIsLoading(false);
        return;
      }

      const eventsData = (data ?? []) as SupabaseEventRow[];
      const eventIds = eventsData.map((event) => String(event.id));
      const countsByEventId: Record<string, { confirmed: number; pending: number; waitlist: number }> = {};

      if (eventIds.length > 0) {
        const { data: registrationsData, error: registrationsError } = await supabase
          .from("registrations")
          .select("event_id,status")
          .in("event_id", eventIds);

        if (registrationsError) {
          setErrorMessage("No se pudieron cargar los recuentos de inscripciones.");
          setEvents([]);
          setIsLoading(false);
          return;
        }

        (registrationsData as RegistrationCountRow[] | null)?.forEach((registration) => {
          const eventId = String(registration.event_id ?? "");
          if (!eventId) return;
          if (!countsByEventId[eventId]) {
            countsByEventId[eventId] = { confirmed: 0, pending: 0, waitlist: 0 };
          }
          if (registration.status === "confirmed") {
            countsByEventId[eventId].confirmed += 1;
          } else if (registration.status === "pending") {
            countsByEventId[eventId].pending += 1;
          } else if (registration.status === "waitlist") {
            countsByEventId[eventId].waitlist += 1;
          }
        });
      }

      const mappedEvents = eventsData.map((row, index) =>
        mapSupabaseEventToEvent(row, index, countsByEventId),
      );

      setEvents(mappedEvents);
      setIsLoading(false);
    }

    async function fetchRecentRegistrations() {
      setIsRecentLoading(true);
      setRecentError(null);

      const { data: registrationsData, error: registrationsError } = await supabase
        .from("registrations")
        .select("id,client_id,event_id,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!isMounted) return;

      if (registrationsError) {
        setRecentError(registrationsError.message || "No se pudieron cargar los registros recientes.");
        setRecentRegistrations([]);
        setIsRecentLoading(false);
        return;
      }

      const registrationRows = (registrationsData as SupabaseRegistrationRow[] | null) ?? [];
      const clientIds = Array.from(
        new Set(
          registrationRows
            .map((registration) => registration.client_id)
            .filter((clientId): clientId is string | number => Boolean(clientId))
            .map(String),
        ),
      );
      const eventIds = Array.from(
        new Set(
          registrationRows
            .map((registration) => registration.event_id)
            .filter((eventId): eventId is string | number => Boolean(eventId))
            .map(String),
        ),
      );

      let clientsById: Record<string, SupabaseClientRow> = {};
      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id,full_name,email")
          .in("id", clientIds);

        if (!isMounted) return;

        if (clientsError) {
          setRecentError(clientsError.message || "No se pudieron cargar los registros recientes.");
          setRecentRegistrations([]);
          setIsRecentLoading(false);
          return;
        }

        clientsById = ((clientsData as SupabaseClientRow[] | null) ?? []).reduce(
          (accumulator, client) => {
            accumulator[String(client.id)] = client;
            return accumulator;
          },
          {} as Record<string, SupabaseClientRow>,
        );
      }

      let eventsById: Record<string, { id: string | number; title: string | null; slug: string | null }> =
        {};
      if (eventIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id,title,slug")
          .in("id", eventIds);

        if (!isMounted) return;

        if (eventsError) {
          setRecentError(eventsError.message || "No se pudieron cargar los registros recientes.");
          setRecentRegistrations([]);
          setIsRecentLoading(false);
          return;
        }

        eventsById = ((eventsData as { id: string | number; title: string | null; slug: string | null }[] | null) ??
          []).reduce(
          (accumulator, event) => {
            accumulator[String(event.id)] = event;
            return accumulator;
          },
          {} as Record<string, { id: string | number; title: string | null; slug: string | null }>,
        );
      }

      const formatted = registrationRows.map((registration) => {
        const client = clientsById[String(registration.client_id ?? "")];
        const event = eventsById[String(registration.event_id ?? "")];

        const createdAt = registration.created_at ? new Date(registration.created_at) : null;
        const createdAtLabel = createdAt
          ? createdAt.toLocaleString("es-ES", {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";

        return {
          id: String(registration.id),
          clientName: client?.full_name ?? "Asistente desconocido",
          clientEmail: client?.email ?? "Sin email",
          eventLabel: event?.title?.trim() || event?.slug?.trim() || "Evento desconocido",
          status:
            registration.status === "waitlist"
              ? "waitlist"
              : registration.status === "pending"
                ? "pending"
                : registration.status === "cancelled"
                  ? "cancelled"
                  : "confirmed",
          createdAtLabel,
        } satisfies RecentRegistrationView;
      });

      setRecentRegistrations(formatted);
      setIsRecentLoading(false);
    }

    fetchEvents();
    fetchRecentRegistrations();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCopyRegistrationLink(slug: string) {
    const origin = window.location.origin;
    const registrationLink = `${origin}/events/${slug}`;

    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((current) => (current === slug ? null : current)), 1600);
    } catch (error) {
      console.warn("Copy registration link failed:", error);
    }
  }

  async function handleDuplicateEvent(eventId: string) {
    if (duplicatingEventId) return;
    setDuplicateError(null);
    setDuplicatingEventId(eventId);

    const { data: sourceEvent, error: fetchError } = await supabase
      .from("events")
      .select(
        "id,title,slug,short_description,long_description,category,event_date,event_time,location,capacity,is_paid,price,waitlist_enabled,is_published",
      )
      .eq("id", eventId)
      .maybeSingle();

    if (fetchError || !sourceEvent) {
      setDuplicateError(fetchError?.message || "No se pudo cargar el evento para duplicar.");
      setDuplicatingEventId(null);
      return;
    }

    const source = sourceEvent as SupabaseEventRow;
    const sourceTitle = source.title?.trim() || "Evento sin título";
    const nextTitle = `${sourceTitle} (copia)`;

    const baseSlug = generateSlug(nextTitle) || "event-copy";
    let slug = baseSlug;

    const { data: existingSlugRows, error: slugCheckError } = await supabase
      .from("events")
      .select("slug")
      .like("slug", `${baseSlug}%`)
      .limit(25);

    if (slugCheckError) {
      setDuplicateError(slugCheckError.message || "No se pudo validar el slug del evento.");
      setDuplicatingEventId(null);
      return;
    }

    const existingSlugs = new Set(
      (existingSlugRows as Array<{ slug: string | null }> | null)?.map((row) => row.slug).filter(Boolean) ?? [],
    );
    if (existingSlugs.has(baseSlug)) {
      let suffix = 2;
      while (existingSlugs.has(`${baseSlug}-${suffix}`)) suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("events")
      .insert({
        title: nextTitle,
        slug,
        short_description: source.short_description ?? source.long_description ?? "",
        long_description: source.long_description ?? source.short_description ?? "",
        category: source.category,
        event_date: source.event_date,
        event_time: source.event_time,
        location: source.location,
        capacity: source.capacity,
        is_paid: source.is_paid,
        price: source.price,
        waitlist_enabled: source.waitlist_enabled,
        is_published: false,
      })
      .select("slug")
      .single();

    if (insertError || !inserted?.slug) {
      setDuplicateError(insertError?.message || "No se pudo duplicar este evento.");
      setDuplicatingEventId(null);
      return;
    }

    router.push(`/admin/events/${String(inserted.slug)}/edit`);
  }

  const adminEvents = useMemo(
    () =>
      sortEventsForAdmin(events).map((event) => ({
        event,
        availability: getEventAvailability(event),
      })),
    [events],
  );

  const summary = useMemo(() => {
    const totalEvents = events.length;
    const totalRegistrations = events.reduce(
      (total, event) => total + event.confirmedCount + event.waitlistCount,
      0,
    );
    const confirmedAttendees = events.reduce(
      (total, event) => total + event.confirmedCount,
      0,
    );
    const waitlistCount = events.reduce((total, event) => total + event.waitlistCount, 0);

    return {
      totalEvents,
      totalRegistrations,
      confirmedAttendees,
      waitlistCount,
    };
  }, [events]);

  return (
    <AdminShell
      title="Panel de operaciones"
      subtitle="Monitoriza la capacidad, identifica eventos llenos y detecta dónde hace falta promoción."
      actions={
        <Link
          href="/admin/events/new"
          className="rounded-lg bg-[var(--accent-button)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)]"
        >
          {labels.createEvent}
        </Link>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label={labels.totalEvents} value={summary.totalEvents} hint="Activos en el ciclo actual" />
        <StatsCard
          label={labels.totalRegistrations}
          value={summary.totalRegistrations}
          hint="Confirmados más lista de espera"
        />
        <StatsCard
          label={labels.confirmedAttendees}
          value={summary.confirmedAttendees}
          hint="Plazas ocupadas"
        />
        <StatsCard label={labels.waitlistCount} value={summary.waitlistCount} hint="Demanda en espera" />
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{labels.eventManagement}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Priorizados por urgencia: lista de espera y eventos llenos primero.
          </p>
        </div>
        {duplicateError ? (
          <p className="border-b border-zinc-200 px-5 py-3 text-sm text-rose-600">
            {duplicateError}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="w-[40%] min-w-[360px] px-5 py-3 font-medium">Evento</th>
                <th className="w-[160px] px-4 py-3 font-medium">{labels.status}</th>
                <th className="w-[90px] px-3 py-3 font-medium">{labels.capacity}</th>
                <th className="w-[110px] px-3 py-3 font-medium">{labels.confirmed}</th>
                <th className="w-[100px] px-3 py-3 font-medium">{labels.waitlist}</th>
                <th className="w-[110px] px-3 py-3 font-medium">{labels.remaining}</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="border-t border-zinc-100">
                  <td colSpan={7} className="px-5 py-6 text-center text-zinc-500">
                    {labels.loading}
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr className="border-t border-zinc-100">
                  <td colSpan={7} className="px-5 py-6 text-center text-rose-600">
                    {errorMessage}
                  </td>
                </tr>
              ) : adminEvents.length === 0 ? (
                <tr className="border-t border-zinc-100">
                  <td colSpan={7} className="px-5 py-6 text-center text-zinc-500">
                    {labels.noEvents}
                  </td>
                </tr>
              ) : (
                adminEvents.map(({ event, availability }) => (
                  <tr key={event.id} className="border-t border-zinc-100">
                    <td className="w-[40%] min-w-[360px] px-5 py-4 align-top">
                      <p className="max-w-[520px] whitespace-normal break-normal font-medium leading-snug text-zinc-900">
                        {event.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {event.date} - {event.location}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <EventStatusBadge status={availability.status} />
                    </td>
                    <td className="px-3 py-4 text-zinc-700">{availability.capacity}</td>
                    <td className="px-3 py-4 text-zinc-700">{availability.confirmedCount}</td>
                    <td className="px-3 py-4 text-zinc-700">{availability.waitlistCount}</td>
                    <td className="px-3 py-4 text-zinc-700">{availability.remainingSpots}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/events/${event.slug}/edit`}
                          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          {labels.editEvent}
                        </Link>
                        <Link
                          href={`/admin/events/${event.slug}/attendees`}
                          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          {labels.viewAttendees}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDuplicateEvent(event.id)}
                          disabled={duplicatingEventId === event.id}
                          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {duplicatingEventId === event.id ? labels.duplicating : labels.duplicate}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyRegistrationLink(event.slug)}
                          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          {copiedSlug === event.slug ? labels.copied : labels.copyLink}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Comparte este enlace privado con los invitados.
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{labels.recentRegistrations}</h2>
        </div>
        <div className="px-5 py-3">
          {isRecentLoading ? (
            <p className="text-sm text-zinc-500">{labels.loading}</p>
          ) : recentError ? (
            <p className="text-sm text-rose-600">{recentError}</p>
          ) : recentRegistrations.length === 0 ? (
            <p className="text-sm text-zinc-500">{labels.noRegistrations}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentRegistrations.map((registration) => (
                <li key={registration.id} className="py-4 last:pb-0">
                  <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="break-words text-sm font-semibold text-zinc-900">
                        {registration.clientName}
                      </p>
                      <p className="break-words text-xs leading-relaxed text-zinc-500">
                        <span className="break-all">{registration.clientEmail}</span>
                        <span className="text-zinc-400"> · </span>
                        <span>{registration.eventLabel}</span>
                      </p>
                    </div>
                    <div className="flex min-w-0 shrink-0 flex-col items-start gap-1.5 md:items-end md:text-right">
                      <span
                        className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                          registration.status === "waitlist"
                            ? "bg-amber-50 text-amber-900 ring-amber-200/80"
                            : registration.status === "pending"
                              ? "bg-zinc-100 text-zinc-700 ring-zinc-300/80"
                              : registration.status === "cancelled"
                                ? "bg-rose-50 text-rose-900 ring-rose-200/80"
                                : "bg-emerald-50 text-emerald-900 ring-emerald-200/80"
                        }`}
                      >
                        {getRegistrationStatusLabel(registration.status)}
                      </span>
                      <p className="max-w-full break-words text-xs text-zinc-500">
                        {registration.createdAtLabel}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  );
}