"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { formatPublicEventDateTime } from "@/lib/date-utils";
import { getRemainingSpots } from "@/lib/event-capacity";
import { getCancelRegistrationConfirmMessage, getRegistrationStatusLabel, labels } from "@/lib/labels";
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
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | "unknown";
  createdAt: string | null;
};

const ATTENDEE_STATUS_ORDER: Record<AttendeeView["status"], number> = {
  confirmed: 0,
  waitlist: 1,
  pending: 2,
  cancelled: 3,
  unknown: 4,
};

function normalizeRegistrationStatus(
  status: RegistrationRow["status"],
): AttendeeView["status"] {
  if (
    status === "confirmed" ||
    status === "waitlist" ||
    status === "pending" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "unknown";
}

function badgeClass(status: AttendeeView["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700";
    case "waitlist":
      return "bg-amber-50 text-amber-700";
    case "pending":
      return "bg-blue-50 text-blue-700";
    case "cancelled":
      return "bg-zinc-100 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function sortAttendees(rows: AttendeeView[]) {
  return [...rows].sort((a, b) => {
    const statusDiff = ATTENDEE_STATUS_ORDER[a.status] - ATTENDEE_STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

async function loadAttendeesForEvent(eventId: string | number) {
  const { data: registrationsData, error: registrationsError } = await supabase
    .from("registrations")
    .select("id,client_id,status,created_at")
    .eq("event_id", String(eventId))
    .order("created_at", { ascending: true });

  if (registrationsError) {
    return { attendees: null, error: registrationsError };
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
      return { attendees: null, error: clientsError };
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
    return {
      id: String(registration.id),
      fullName: client?.full_name ?? "Asistente desconocido",
      email: client?.email ?? "Sin email",
      phone: client?.phone ?? "-",
      status: normalizeRegistrationStatus(registration.status),
      createdAt: registration.created_at ?? null,
    } satisfies AttendeeView;
  });

  return { attendees: sortAttendees(attendeeRows), error: null };
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
  const [sendingPaymentLinkId, setSendingPaymentLinkId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    level: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const isPaidEvent = Boolean(eventRow?.is_paid ?? (Number(eventRow?.price ?? 0) > 0));
  const waitlistCount = attendees.filter((attendee) => attendee.status === "waitlist").length;
  const confirmedCount = attendees.filter((attendee) => attendee.status === "confirmed").length;
  const pendingCount = attendees.filter((attendee) => attendee.status === "pending").length;
  const registrationCounts = {
    confirmed: confirmedCount,
    pending: pendingCount,
    waitlist: waitlistCount,
  };
  const remainingSpots = getRemainingSpots(eventRow?.capacity ?? 0, registrationCounts, isPaidEvent);

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
        setErrorMessage(labels.couldNotLoadEvent);
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

      const { attendees: loadedAttendees, error: loadError } = await loadAttendeesForEvent(event.id);

      if (loadError) {
        setErrorMessage(labels.couldNotLoadAttendees);
        setIsLoading(false);
        return;
      }

      setAttendees(loadedAttendees ?? []);
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

    const { attendees: loadedAttendees, error: loadError } = await loadAttendeesForEvent(eventRow.id);

    if (loadError) {
      setErrorMessage(labels.couldNotRefreshAttendees);
      return;
    }

    setAttendees(loadedAttendees ?? []);
  }

  async function requestWaitlistPaymentLink(options: {
    registrationId: string;
    requireAvailableSpot?: boolean;
    resend?: boolean;
    successMessage?: string;
  }): Promise<{ level: "success" | "warning" | "error"; message: string }> {
    try {
      const response = await fetch("/api/admin/send-waitlist-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: options.registrationId,
          requireAvailableSpot: options.requireAvailableSpot,
          resend: options.resend ?? false,
          successMessage: options.successMessage,
        }),
      });

      const body = (await response.json()) as {
        level?: "success" | "warning" | "error";
        message?: string;
      };

      return {
        level: body.level ?? "error",
        message: body.message ?? labels.couldNotSendPaymentLink,
      };
    } catch (error) {
      console.error("[waitlist-payment] Admin request failed:", error);
      return { level: "error", message: labels.couldNotSendPaymentLink };
    }
  }

  async function handleSendPaymentLink(attendee: AttendeeView) {
    if (!eventRow || attendee.status !== "waitlist" || sendingPaymentLinkId) return;

    setSendingPaymentLinkId(attendee.id);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const result = await requestWaitlistPaymentLink({
        registrationId: attendee.id,
        requireAvailableSpot: true,
        successMessage: labels.paymentLinkSent,
      });
      setFeedbackMessage(result);
      await refreshAttendees();
    } finally {
      setSendingPaymentLinkId(null);
    }
  }

  async function handleResendPaymentLink(attendee: AttendeeView) {
    if (!eventRow || attendee.status !== "pending" || sendingPaymentLinkId) return;

    setSendingPaymentLinkId(attendee.id);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const result = await requestWaitlistPaymentLink({
        registrationId: attendee.id,
        resend: true,
        successMessage: labels.paymentLinkResent,
      });
      setFeedbackMessage(result);
    } finally {
      setSendingPaymentLinkId(null);
    }
  }

  async function handleCancelRegistration(attendee: AttendeeView) {
    if (!eventRow) return;
    if (attendee.status === "cancelled") return;
    if (cancellingId) return;

    const confirmed = window.confirm(getCancelRegistrationConfirmMessage(attendee.fullName));
    if (!confirmed) return;

    setCancellingId(attendee.id);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await fetch("/api/admin/cancel-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: attendee.id }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        level?: "success" | "warning" | "error";
        message?: string;
      };

      if (!response.ok || body.ok === false) {
        setErrorMessage(body.message ?? labels.couldNotCancelRegistration);
        return;
      }

      setFeedbackMessage({
        level: body.level ?? "success",
        message: body.message ?? labels.cancelRegistrationDone,
      });
      await refreshAttendees();
    } catch (error) {
      console.error("[admin] Cancel registration request failed:", error);
      setErrorMessage(labels.couldNotCancelRegistration);
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
      const header = ["Nombre", "Correo electrónico", "Evento", "Estado", "Fecha de inscripción"];
      const rows = attendees.map((attendee) => {
        const createdAtIso = attendee.createdAt ? new Date(attendee.createdAt).toISOString() : "";
        return [
          escapeCsvValue(attendee.fullName),
          escapeCsvValue(attendee.email),
          escapeCsvValue(eventRow.title ?? eventRow.slug ?? "Evento"),
          escapeCsvValue(getRegistrationStatusLabel(attendee.status)),
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
    <AdminShell title={labels.viewAttendees} subtitle={labels.viewAttendeesSubtitle}>
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-zinc-600">{labels.loading}</p>
        ) : isNotFound ? (
          <p className="text-sm text-zinc-600">{labels.eventNotFound}</p>
        ) : errorMessage ? (
          <p className="text-sm text-rose-600">{errorMessage}</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-zinc-900">{eventRow?.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {eventRow?.event_date && eventRow?.event_time
                ? formatPublicEventDateTime(eventRow.event_date, eventRow.event_time)
                : eventRow?.event_date
                  ? formatPublicEventDateTime(eventRow.event_date, "TBD")
                  : null}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{eventRow?.location}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {labels.capacity}: {eventRow?.capacity ?? 0}
              {isPaidEvent ? (
                <>
                  {" "}
                  · {labels.confirmed}: {confirmedCount} · Pendientes de pago: {pendingCount} ·{" "}
                  {labels.remaining}: {remainingSpots}
                </>
              ) : null}
            </p>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {labels.backToDashboard}
          </Link>
          <button
            type="button"
            onClick={handleDownloadAttendees}
            disabled={!eventRow || attendees.length === 0 || isLoading || Boolean(errorMessage) || isDownloading}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {isDownloading ? labels.preparing : labels.downloadAttendees}
          </button>
          <button
            type="button"
            onClick={handleCopyRegistrationLink}
            disabled={!routeSlug}
            className="inline-flex rounded-lg bg-[var(--accent-button)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {copied ? labels.copied : labels.copyLink}
          </button>
          <p className="text-xs text-zinc-500">{labels.sharePrivateLink}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-zinc-900">{labels.attendees}</h3>
          {isPaidEvent && (waitlistCount > 0 || pendingCount > 0) ? (
            <p className="mt-1 text-sm text-amber-800">{labels.paidEventWaitlistNote}</p>
          ) : null}
        </div>
        <div className="px-5 py-6">
          {feedbackMessage ? (
            <p
              className={[
                "mb-4 rounded-lg border px-3 py-2 text-sm",
                feedbackMessage.level === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : feedbackMessage.level === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-rose-200 bg-rose-50 text-rose-800",
              ].join(" ")}
            >
              {feedbackMessage.message}
            </p>
          ) : null}
          {attendees.length === 0 ? (
            <>
              <p className="text-sm font-medium text-zinc-800">{labels.noAttendeesYet}</p>
              <p className="mt-1 text-sm text-zinc-600">{labels.noAttendeesHint}</p>
            </>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {attendees.map((attendee) => (
                <li key={attendee.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{attendee.fullName}</p>
                    <p className="text-xs text-zinc-500">
                      {attendee.email} · {attendee.phone}
                    </p>
                    {isPaidEvent && attendee.status === "pending" ? (
                      <p className="mt-1 text-xs text-blue-700">{labels.pendingReservesSpot}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                        badgeClass(attendee.status),
                      ].join(" ")}
                    >
                      {getRegistrationStatusLabel(attendee.status)}
                    </span>
                    {isPaidEvent && attendee.status === "waitlist" && remainingSpots > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleSendPaymentLink(attendee)}
                        disabled={Boolean(sendingPaymentLinkId) || Boolean(cancellingId)}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingPaymentLinkId === attendee.id
                          ? labels.sendingPaymentLink
                          : labels.sendPaymentLink}
                      </button>
                    ) : null}
                    {isPaidEvent && attendee.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleResendPaymentLink(attendee)}
                        disabled={Boolean(sendingPaymentLinkId) || Boolean(cancellingId)}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingPaymentLinkId === attendee.id
                          ? labels.resendingPaymentLink
                          : labels.resendPaymentLink}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleCancelRegistration(attendee)}
                      disabled={
                        attendee.status === "cancelled" ||
                        cancellingId === attendee.id ||
                        Boolean(sendingPaymentLinkId)
                      }
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === attendee.id ? labels.cancelling : labels.cancel}
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
