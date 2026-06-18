"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import {
  RegistrationForm,
  type RegistrationSubmitPayload,
} from "@/components/events/registration-form";
import { Container } from "@/components/layout/container";
import { PublicShell } from "@/components/layout/public-shell";
import { formatPublicEventDateTime } from "@/lib/date-utils";
import { getEventStatus } from "@/lib/event-utils";
import { labels } from "@/lib/labels";
import {
  REGISTRATION_USER_ERROR,
  registrationUserError,
  resolveRegistrationPaymentStatus,
} from "@/lib/registration-utils";
import { supabase } from "@/lib/supabase";
import type { EventCategory, EventStatus, EventType } from "@/lib/types";

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  short_description: string | null;
  long_description: string | null;
  category: EventCategory | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  capacity: number | null;
  is_paid: boolean | null;
  price: number | null;
  waitlist_enabled: boolean | null;
  is_published: boolean | null;
};

type EventDetailView = {
  id: string;
  title: string;
  slug: string;
  date: string;
  time: string;
  location: string;
  description: string;
  category: EventCategory;
  type: EventType;
  isPaid: boolean;
  price: number;
  capacity: number;
  waitlistEnabled: boolean;
};

function mapEventRow(row: SupabaseEventRow): EventDetailView {
  const isPaid = Boolean(row.is_paid ?? (row.price ?? 0) > 0);
  const price = Number(row.price ?? 0);
  return {
    id: String(row.id),
    title: row.title ?? "Evento sin título",
    slug: row.slug ?? "",
    date: row.event_date ?? "TBD",
    time: row.event_time ?? "TBD",
    location: row.location ?? "Ubicación pendiente",
    description: row.short_description ?? row.long_description ?? "Detalles próximamente.",
    category: row.category ?? "Networking",
    type: isPaid ? "Paid" : "Free",
    isPaid,
    price,
    capacity: row.capacity ?? 0,
    waitlistEnabled: row.waitlist_enabled ?? true,
  };
}

export default function EventDetailPage() {
  const params = useParams<{ slug?: string | string[] }>();
  const routeSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [eventData, setEventData] = useState<EventDetailView | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchEventAndAvailability() {
      if (!routeSlug) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setIsNotFound(false);

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select(
          "id,title,slug,short_description,long_description,category,event_date,event_time,location,capacity,is_paid,price,waitlist_enabled,is_published",
        )
        .eq("slug", routeSlug)
        .eq("is_published", true)
        .maybeSingle();

      if (!isMounted) return;

      if (eventError) {
        setErrorMessage("No se pudo cargar este evento.");
        setIsLoading(false);
        return;
      }

      if (!eventRow) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      const mappedEvent = mapEventRow(eventRow as SupabaseEventRow);
      setEventData(mappedEvent);

      const [{ count: confirmed, error: confirmedError }, pendingResult] = await Promise.all([
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", mappedEvent.id)
          .eq("status", "confirmed"),
        mappedEvent.isPaid
          ? supabase
              .from("registrations")
              .select("id", { count: "exact", head: true })
              .eq("event_id", mappedEvent.id)
              .eq("status", "pending")
          : Promise.resolve({ count: 0, error: null }),
      ]);

      if (!isMounted) return;

      if (confirmedError || pendingResult.error) {
        setErrorMessage("No se pudo cargar la disponibilidad del evento.");
        setIsLoading(false);
        return;
      }

      setConfirmedCount(confirmed ?? 0);
      setPendingCount(pendingResult.count ?? 0);
      setIsLoading(false);
    }

    fetchEventAndAvailability();

    return () => {
      isMounted = false;
    };
  }, [routeSlug]);

  const availability = useMemo(() => {
    if (!eventData) return null;
    const occupiedCount = eventData.isPaid
      ? confirmedCount + pendingCount
      : confirmedCount;
    const remainingSpots = Math.max(eventData.capacity - occupiedCount, 0);
    const status: EventStatus = getEventStatus(
      eventData.capacity,
      confirmedCount,
      eventData.waitlistEnabled,
      { pendingCount, isPaidEvent: eventData.isPaid },
    );
    return {
      remainingSpots,
      status,
    };
  }, [eventData, confirmedCount, pendingCount]);

  const formattedPrice = useMemo(() => {
    if (!eventData) return "";
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: Number.isInteger(eventData.price) ? 0 : 2,
    });
    return formatter.format(eventData.price);
  }, [eventData]);

  async function redirectToCheckout(registrationId: string) {
    const checkoutResponse = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registrationId,
        eventSlug: eventData!.slug,
      }),
    });

    const checkoutBody = (await checkoutResponse.json()) as { url?: string; error?: string };
    if (!checkoutResponse.ok || !checkoutBody.url) {
      console.error(
        "[registration] create checkout session failed:",
        checkoutBody.error ?? checkoutResponse.status,
      );
      throw new Error(REGISTRATION_USER_ERROR);
    }

    window.location.assign(checkoutBody.url);
  }

  async function handleRegister(
    payload: RegistrationSubmitPayload,
  ): Promise<{ registrationStatus: "confirmed" | "waitlist" | "pending"; resumePayment?: boolean }> {
    if (!eventData || !availability) {
      throw new Error("El evento no está listo. Inténtalo de nuevo.");
    }

    const privacyAcceptedAt = payload.privacyAccepted ? new Date().toISOString() : null;

    const { data: existingClient, error: existingClientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", payload.email)
      .limit(1);

    if (existingClientError) {
      throw registrationUserError("verify client profile", existingClientError);
    }

    let clientId = existingClient?.[0]?.id as string | number | undefined;

    if (clientId) {
      const { error: updateClientError } = await supabase
        .from("clients")
        .update({
          full_name: payload.fullName,
          email: payload.email,
          phone: payload.phone || null,
          marketing_consent: payload.marketingConsent,
          privacy_accepted: payload.privacyAccepted,
          privacy_accepted_at: privacyAcceptedAt,
        })
        .eq("id", clientId);

      if (updateClientError) {
        throw registrationUserError("update client profile", updateClientError);
      }
    } else {
      const { data: insertedClient, error: insertClientError } = await supabase
        .from("clients")
        .insert({
          full_name: payload.fullName,
          email: payload.email,
          phone: payload.phone || null,
          marketing_consent: payload.marketingConsent,
          privacy_accepted: payload.privacyAccepted,
          privacy_accepted_at: privacyAcceptedAt,
        })
        .select("id")
        .single();

      if (insertClientError || !insertedClient?.id) {
        throw registrationUserError("create client profile", insertClientError);
      }

      clientId = insertedClient.id as string | number;
    }

    const requestedRegistrationStatus: "confirmed" | "waitlist" =
      availability.remainingSpots > 0 ? "confirmed" : "waitlist";

    const { data: existingRegistration, error: existingRegistrationError } = await supabase
      .from("registrations")
      .select("id,status")
      .eq("client_id", clientId)
      .eq("event_id", eventData.id)
      .maybeSingle();

    if (existingRegistrationError) {
      throw registrationUserError("verify existing registration", existingRegistrationError);
    }

    if (existingRegistration?.id) {
      const existingStatus = existingRegistration.status;

      if (existingStatus === "pending" && eventData.isPaid) {
        await redirectToCheckout(String(existingRegistration.id));
        return { registrationStatus: "pending", resumePayment: true };
      }

      throw new Error("Ya estás registrado en este evento.");
    }

    if (availability.remainingSpots <= 0 && !eventData.waitlistEnabled) {
      throw new Error("Este evento está agotado y la lista de espera no está activada.");
    }

    const registrationStatus: "confirmed" | "pending" | "waitlist" =
      requestedRegistrationStatus === "waitlist"
        ? "waitlist"
        : eventData.isPaid
          ? "pending"
          : "confirmed";

    const paymentStatus = resolveRegistrationPaymentStatus(registrationStatus, eventData.isPaid);

    const { data: insertedRegistration, error: registrationError } = await supabase
      .from("registrations")
      .insert({
        client_id: clientId,
        event_id: eventData.id,
        status: registrationStatus,
        payment_status: paymentStatus,
      })
      .select("id")
      .single();

    if (registrationError) {
      throw registrationUserError("insert registration", registrationError);
    }

    if (registrationStatus === "confirmed") {
      setConfirmedCount((current) => current + 1);
    } else if (registrationStatus === "pending") {
      setPendingCount((current) => current + 1);
    }

    if (!eventData.isPaid && registrationStatus === "confirmed") {
      try {
        const emailResponse = await fetch("/api/send-confirmation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: payload.fullName,
            email: payload.email,
            eventTitle: eventData.title,
            eventDate: eventData.date,
            eventTime: eventData.time,
            eventLocation: eventData.location,
            isPaid: false,
            phone: payload.phone,
            marketingConsent: payload.marketingConsent,
            privacyAccepted: payload.privacyAccepted,
            registrationId: insertedRegistration.id,
          }),
        });

        if (!emailResponse.ok) {
          console.warn(
            "[email] Confirmation email request failed after free registration:",
            emailResponse.status,
          );
        }
      } catch (emailError) {
        console.error("[email] Confirmation email failed after free registration:", emailError);
      }
    }

    if (!eventData.isPaid || registrationStatus === "waitlist") {
      return { registrationStatus: registrationStatus === "waitlist" ? "waitlist" : "confirmed" };
    }

    if (!insertedRegistration?.id) {
      throw new Error(REGISTRATION_USER_ERROR);
    }

    await redirectToCheckout(String(insertedRegistration.id));

    return { registrationStatus: "pending" };
  }

  return (
    <PublicShell>
      <div className="py-12 sm:py-16">
        <Container>
          <Link
            href="/events"
            className="text-sm text-[var(--accent)] underline-offset-4 transition hover:underline"
          >
            {labels.back}
          </Link>

          {isLoading ? (
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-zinc-600">Cargando detalles del evento...</p>
            </section>
          ) : isNotFound ? (
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-zinc-600">Evento no encontrado.</p>
            </section>
          ) : errorMessage || !eventData || !availability ? (
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-rose-600">{errorMessage ?? "No se pudo cargar este evento."}</p>
            </section>
          ) : (
            <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {eventData.category}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {eventData.isPaid ? labels.paid : labels.free}
                  </span>
                  {eventData.isPaid ? (
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-xs font-medium text-[var(--on-accent)] ring-1 ring-inset ring-[color:var(--accent-ring)]">
                      {formattedPrice}
                    </span>
                  ) : null}
                  <EventStatusBadge status={availability.status} variant="public" />
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">
                  {eventData.title}
                </h1>
                <p className="mt-4 text-zinc-700">{eventData.description}</p>

                <dl className="mt-6 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <dt className="text-zinc-500">{labels.dateAndTime}</dt>
                    <dd className="mt-1 font-medium">
                      {formatPublicEventDateTime(eventData.date, eventData.time)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <dt className="text-zinc-500">{labels.location}</dt>
                    <dd className="mt-1 font-medium">{eventData.location}</dd>
                  </div>
                  {eventData.isPaid ? (
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <dt className="text-zinc-500">{labels.price}</dt>
                      <dd className="mt-1 font-medium">{formattedPrice}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>

              <RegistrationForm
                eventTitle={eventData.title}
                onSubmit={handleRegister}
                isDisabled={availability.status === "Sold out" && !eventData.isPaid}
                disabledMessage={
                  availability.status === "Sold out" && !eventData.isPaid
                    ? "Este evento está agotado y la lista de espera no está activada."
                    : undefined
                }
                submitLabel={
                  availability.status === "Waitlist only"
                    ? labels.joinWaitlist
                    : eventData.isPaid
                      ? `${labels.registerAndPay} ${formattedPrice}`
                      : labels.register
                }
                submitNote={
                  availability.status === "Waitlist only"
                    ? "No se requiere pago para apuntarse a la lista de espera."
                    : eventData.isPaid
                      ? "Serás redirigido a Stripe para completar el pago."
                      : undefined
                }
              />
            </section>
          )}
        </Container>
      </div>
    </PublicShell>
  );
}
