"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
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

type RegistrationRow = {
  id: string | number;
  client_id: string | number | null;
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | null;
  created_at: string | null;
};

type ClientRow = {
  id: string | number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type AttendeeView = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: "confirmed" | "cancelled";
  createdAt: string | null;
};

function badgeClass(status: AttendeeView["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "bg-zinc-100 text-zinc-700";
  }
}

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

export default function AdminAttendeesPage() {
  const params = useParams<{ slug?: string | string[] }>();
  const routeSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [eventRow, setEventRow] = useState<SupabaseEventRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeView[]>([]);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchEventBySlug() {
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

      const event = data as SupabaseEventRow;
      setEventRow(event);

      const { data: registrationsData, error: registrationsError } = await supabase
        .from("registrations")
        .select("id,client_id,status,created_at")
        .eq("event_id", String(event.id))
        .in("status", ["confirmed", "cancelled"])
        .order("created_at", { ascending: true });

      if (registrationsError) {
        setErrorMessage("Could not load attendees.");
        setIsLoading(false);
        return;
      }

      const registrationRows = (registrationsData as RegistrationRow[] | null) ?? [];
      const clientIds = registrationRows
        .map((registration) => registration.client_id)
        .filter((clientId): clientId is string | number => Boolean(clientId))
        .map(String);

      let clientsById: Record<string, ClientRow> = {};

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id,full_name,email,phone")
          .in("id", clientIds);

        if (clientsError) {
          setErrorMessage("Could not load attendee details.");
          setIsLoading(false);
          return;
        }

        clientsById = ((clientsData as ClientRow[] | null) ?? []).reduce(
          (accumulator, client) => {
            accumulator[String(client.id)] = client;
            return accumulator;
          },
          {} as Record<string, ClientRow>,
        );
      }

      const attendeeRows = registrationRows.map((registration) => {
        const client = clientsById[String(registration.client_id ?? "")];
        const status: AttendeeView["status"] =
          registration.status === "cancelled" ? "cancelled" : "confirmed";
        return {
          id: String(registration.id),
          fullName: client?.full_name ?? "Unknown attendee",
          email: client?.email ?? "No email",
          phone: client?.phone ?? "-",
          status,
          createdAt: registration.created_at ?? null,
        } as AttendeeView;
      });

      setAttendees(attendeeRows);
      setIsLoading(false);
    }

    fetchEventBySlug();

    return () => {
      isMounted = false;
    };
  }, [routeSlug]);

  async function refreshAttendees() {
    if (!eventRow) return;
    setErrorMessage(null);

    const { data: registrationsData, error: registrationsError } = await supabase
      .from("registrations")
      .select("id,client_id,status,created_at")
      .eq("event_id", String(eventRow.id))
      .in("status", ["confirmed", "cancelled"])
      .order("created_at", { ascending: true });

    if (registrationsError) {
      setErrorMessage("Could not refresh attendees.");
      return;
    }

    const registrationRows = (registrationsData as RegistrationRow[] | null) ?? [];
    const clientIds = registrationRows
      .map((registration) => registration.client_id)
      .filter((clientId): clientId is string | number => Boolean(clientId))
      .map(String);

    let clientsById: Record<string, ClientRow> = {};
    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id,full_name,email,phone")
        .in("id", clientIds);

      if (clientsError) {
        setErrorMessage("Could not refresh attendee details.");
        return;
      }

      clientsById = ((clientsData as ClientRow[] | null) ?? []).reduce(
        (accumulator, client) => {
          accumulator[String(client.id)] = client;
          return accumulator;
        },
        {} as Record<string, ClientRow>,
      );
    }

    const attendeeRows = registrationRows.map((registration) => {
      const client = clientsById[String(registration.client_id ?? "")];
      const status: AttendeeView["status"] =
        registration.status === "cancelled" ? "cancelled" : "confirmed";
      return {
        id: String(registration.id),
        fullName: client?.full_name ?? "Unknown attendee",
        email: client?.email ?? "No email",
        phone: client?.phone ?? "-",
        status,
        createdAt: registration.created_at ?? null,
      } as AttendeeView;
    });

    setAttendees(attendeeRows);
  }

  async function handleCancelRegistration(attendee: AttendeeView) {
    if (!eventRow) return;
    if (attendee.status === "cancelled") return;
    if (cancellingId) return;

    const confirmed = window.confirm(`Cancel ${attendee.fullName}'s registration?`);
    if (!confirmed) return;

    setCancellingId(attendee.id);
    setErrorMessage(null);

    try {
      const candidateId = Number.isFinite(Number(attendee.id)) ? Number(attendee.id) : attendee.id;
      const { error: cancelError } = await supabase
        .from("registrations")
        .update({ status: "cancelled" })
        .eq("id", candidateId);

      if (cancelError) {
        setErrorMessage("Could not cancel this registration.");
        return;
      }

      const { data: waitlistRows, error: waitlistError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", String(eventRow.id))
        .eq("status", "waitlist")
        .order("created_at", { ascending: true })
        .limit(1);

      if (!waitlistError && (waitlistRows?.length ?? 0) > 0) {
        const firstWaitlistId = (waitlistRows?.[0] as { id: string | number } | undefined)?.id;
        if (firstWaitlistId) {
          await supabase.from("registrations").update({ status: "confirmed" }).eq("id", firstWaitlistId);
        }
      }

      await refreshAttendees();
    } finally {
      setCancellingId(null);
    }
  }

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

  async function handleDownloadAttendees() {
    if (!eventRow || isDownloading) return;
    setIsDownloading(true);

    try {
      const header = ["Name", "Email", "Event title", "Registration date"];
      const rows = attendees.map((attendee) => {
        const createdAtIso = attendee.createdAt ? new Date(attendee.createdAt).toISOString() : "";
        return [
          escapeCsvValue(attendee.fullName),
          escapeCsvValue(attendee.email),
          escapeCsvValue(eventRow.title ?? eventRow.slug ?? "Event"),
          escapeCsvValue(createdAtIso),
        ].join(",");
      });

      const csv = [header.map(escapeCsvValue).join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const filenameBase = slugifyFilename(eventRow.title ?? eventRow.slug ?? "event") || "event";
      const filename = `${filenameBase}-attendees.csv`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <AdminShell title="View attendees" subtitle="Monitor registrations and attendee visibility for each event.">
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading event...</p>
        ) : isNotFound ? (
          <p className="text-sm text-zinc-600">Event not found.</p>
        ) : errorMessage ? (
          <p className="text-sm text-rose-600">{errorMessage}</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-zinc-900">{eventRow?.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {eventRow?.event_date} at {eventRow?.event_time}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{eventRow?.location}</p>
            <p className="mt-1 text-sm text-zinc-600">Capacity: {eventRow?.capacity ?? 0}</p>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={handleDownloadAttendees}
            disabled={!eventRow || attendees.length === 0 || isLoading || Boolean(errorMessage) || isDownloading}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {isDownloading ? "Preparing..." : "Download attendees"}
          </button>
          <button
            type="button"
            onClick={handleCopyRegistrationLink}
            disabled={!routeSlug}
            className="inline-flex rounded-lg bg-[var(--accent-button)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {copied ? "Copied" : "Copy registration link"}
          </button>
          <p className="text-xs text-zinc-500">
            Share this private registration link with invited guests. Only people with this link
            can access the registration page.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-zinc-900">Attendees</h3>
        </div>
        <div className="px-5 py-6">
          {attendees.length === 0 ? (
            <>
              <p className="text-sm font-medium text-zinc-800">No attendees yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                Attendee data will appear here once registrations are connected.
              </p>
            </>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {attendees.map((attendee) => (
                <li key={attendee.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{attendee.fullName}</p>
                    <p className="text-xs text-zinc-500">
                      {attendee.email} - {attendee.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        badgeClass(attendee.status),
                      ].join(" ")}
                    >
                      {attendee.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCancelRegistration(attendee)}
                      disabled={attendee.status === "cancelled" || cancellingId === attendee.id}
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === attendee.id ? "Cancelling..." : "Cancel"}
                    </button>
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
