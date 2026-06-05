"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import {
  AdminEventForm,
  type AdminEventFormValues,
  type AdminEventSubmitPayload,
  type EventCategoryOption,
} from "@/components/dashboard/create-event-form";
import { labels } from "@/lib/labels";
import { supabase } from "@/lib/supabase";

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  short_description: string | null;
  long_description: string | null;
  category: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  capacity: number | null;
  is_paid: boolean | null;
  price: number | null;
  waitlist_enabled: boolean | null;
  is_published: boolean | null;
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminEditEventPage() {
  const params = useParams<{ slug?: string | string[] }>();
  const routeSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const router = useRouter();
  const [eventRow, setEventRow] = useState<SupabaseEventRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<EventCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchEventBySlug() {
      console.log("Edit route slug:", routeSlug);

      if (!routeSlug) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setIsNotFound(false);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id,title,slug,short_description,long_description,category,event_date,event_time,location,capacity,is_paid,price,waitlist_enabled,is_published",
        )
        .eq("slug", routeSlug)
        .maybeSingle();

      console.log("Edit fetched data:", data);
      console.log("Edit fetch error:", error);

      if (!isMounted) return;

      if (error) {
        setErrorMessage("Could not load this event.");
        setEventRow(null);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setIsNotFound(true);
        setEventRow(null);
        setIsLoading(false);
        return;
      }

      setEventRow(data as SupabaseEventRow);
      setIsLoading(false);
    }

    fetchEventBySlug();

    return () => {
      isMounted = false;
    };
  }, [routeSlug]);

  useEffect(() => {
    if (!eventRow) {
      return;
    }

    const row = eventRow;

    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) return;
      setCategoriesLoading(true);
      setCategoriesError(null);
      void fetchCategoryOptions();
    });

    async function fetchCategoryOptions() {
      const { data: active, error: activeError } = await supabase
        .from("event_categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("name");

      if (!isMounted) return;

      if (activeError) {
        setCategoriesError(activeError.message || "Could not load categories.");
        setCategoryOptions([]);
        setCategoriesLoading(false);
        return;
      }

      let options = (active ?? []) as EventCategoryOption[];
      const currentName = row.category?.trim();

      if (currentName && !options.some((option) => option.name === currentName)) {
        const { data: existingRow } = await supabase
          .from("event_categories")
          .select("id,name,slug")
          .eq("name", currentName)
          .maybeSingle();

        if (!isMounted) return;

        if (existingRow) {
          options = [existingRow as EventCategoryOption, ...options.filter((o) => o.name !== currentName)];
        } else {
          options = [
            { id: `legacy-${currentName}`, name: currentName, slug: "legacy" },
            ...options,
          ];
        }
      }

      setCategoryOptions(options);
      setCategoriesLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [eventRow]);

  async function handleCopyRegistrationLink() {
    if (!routeSlug) return;
    const origin = window.location.origin;
    const registrationLink = `${origin}/events/${routeSlug}`;

    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.warn("Copy registration link failed:", error);
    }
  }

  async function handleUpdateEvent(payload: AdminEventSubmitPayload) {
    const currentSlug = routeSlug ?? "";
    const nextSlug = generateSlug(payload.title) || currentSlug;

    const { error } = await supabase
      .from("events")
      .update({
        title: payload.title,
        slug: nextSlug,
        short_description: payload.description,
        long_description: payload.description,
        category: payload.category,
        event_date: payload.date,
        event_time: payload.time,
        location: payload.location,
        capacity: payload.capacity,
        is_paid: payload.isPaid,
        price: payload.isPaid ? payload.price : null,
        waitlist_enabled: payload.waitlistEnabled,
        is_published: payload.published,
      })
      .eq("slug", currentSlug);

    if (error) {
      throw new Error(error.message || "Failed to update event.");
    }
  }

  async function handleDeleteEvent() {
    if (isDeleting) return;
    setDeleteError(null);

    const confirmed = window.confirm(
      "Are you sure you want to delete this event? This action cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);

    const eventId = eventRow?.id;
    const slug = routeSlug;

    const deleteQuery = supabase.from("events").delete();
    const { error } = eventId
      ? await deleteQuery.eq("id", eventId)
      : await deleteQuery.eq("slug", slug ?? "");

    if (error) {
      setDeleteError(error.message || "Could not delete this event.");
      setIsDeleting(false);
      return;
    }

    router.push("/");
  }

  const initialValues: Partial<AdminEventFormValues> | null = eventRow
    ? {
        title: eventRow.title ?? "",
        description: eventRow.short_description ?? eventRow.long_description ?? "",
        category: eventRow.category ?? "",
        date: eventRow.event_date ?? "",
        time: eventRow.event_time ?? "",
        location: eventRow.location ?? "",
        capacity: String(eventRow.capacity ?? ""),
        isPaid: Boolean(eventRow.is_paid),
        price: eventRow.is_paid ? String(eventRow.price ?? "") : "",
        waitlistEnabled: eventRow.waitlist_enabled ?? true,
        published: eventRow.is_published ?? false,
      }
    : null;

  return (
    <AdminShell
      title={labels.editEvent}
      subtitle="Actualiza los detalles, precio y ajustes de publicación del evento."
    >
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Editing now</p>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-600">Loading event...</p>
        ) : isNotFound ? (
          <p className="mt-2 text-sm text-zinc-600">Event not found.</p>
        ) : errorMessage ? (
          <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
        ) : (
          <>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900">{eventRow?.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {eventRow?.event_date} at {eventRow?.event_time} - {eventRow?.location}
            </p>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Volver al panel
          </Link>
          <button
            type="button"
            onClick={handleCopyRegistrationLink}
            disabled={!routeSlug}
            className="inline-flex rounded-lg bg-[var(--accent-button)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {copied ? labels.copied : labels.copyLink}
          </button>
          <p className="text-xs text-zinc-500">
            Comparte este enlace privado con los invitados. Solo quienes lo tengan podrán registrarse.
          </p>
        </div>
      </section>

      {!isLoading && !isNotFound && !errorMessage && initialValues ? (
        <AdminEventForm
          key={String(eventRow?.id ?? routeSlug)}
          initialValues={initialValues}
          submitLabel={labels.saveChanges}
          onSubmit={handleUpdateEvent}
          categoryOptions={categoryOptions}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
        />
      ) : null}

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
          Danger zone
        </h3>
        <p className="mt-2 text-sm text-zinc-600">
          Deleting this event will also remove its registrations.
        </p>
        {deleteError ? <p className="mt-3 text-sm text-rose-600">{deleteError}</p> : null}
        <button
          type="button"
          onClick={handleDeleteEvent}
          disabled={isDeleting || isLoading || isNotFound || Boolean(errorMessage)}
          className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          {isDeleting ? labels.deleting : labels.deleteEvent}
        </button>
      </section>
    </AdminShell>
  );
}
