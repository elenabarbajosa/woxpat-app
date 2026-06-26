import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventStatus } from "@/lib/event-utils";
import {
  isActiveRegistrationStatus,
  isInactiveRegistrationStatus,
  isPendingPaymentStatus,
  REGISTRATION_ALREADY_REGISTERED_ERROR,
  REGISTRATION_ALREADY_WAITLISTED_ERROR,
  normalizeRegistrationStatus,
  resolveRegistrationPaymentStatus,
} from "@/lib/registration-utils";

export type RegisterAttendeePayload = {
  eventSlug: string;
  fullName: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  privacyAccepted: boolean;
};

export type RegisterAttendeeResult =
  | {
      ok: true;
      registrationStatus: "confirmed" | "waitlist" | "pending";
      registrationId: string;
      resumePayment?: boolean;
      event: {
        id: string;
        title: string;
        slug: string;
        date: string;
        time: string;
        location: string;
        isPaid: boolean;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

type EventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  capacity: number | null;
  is_paid: boolean | null;
  price: number | null;
  waitlist_enabled: boolean | null;
  is_published: boolean | null;
};

type ExistingRegistrationRow = {
  id: string | number;
  status: string | null;
  created_at: string | null;
};

function eventIdCandidates(eventId: string | number): Array<string | number> {
  const candidates: Array<string | number> = [eventId];
  const asNumber = Number(eventId);
  if (Number.isFinite(asNumber)) {
    candidates.push(asNumber);
  }
  return candidates;
}

function buildEventPayload(event: EventRow, eventSlug: string, isPaid: boolean) {
  return {
    id: String(event.id),
    title: event.title ?? "Evento sin título",
    slug: event.slug ?? eventSlug,
    date: event.event_date ?? "TBD",
    time: event.event_time ?? "TBD",
    location: event.location ?? "Ubicación pendiente",
    isPaid,
  };
}

function pickLatestRegistration(
  registrations: ExistingRegistrationRow[],
): ExistingRegistrationRow | null {
  if (registrations.length === 0) return null;

  return [...registrations].sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return rightTime - leftTime;
  })[0];
}

async function loadExistingRegistrations(
  supabase: SupabaseClient,
  clientId: string | number,
  eventId: string | number,
): Promise<ExistingRegistrationRow[] | null> {
  for (const candidateEventId of eventIdCandidates(eventId)) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id,status,created_at")
      .eq("client_id", clientId)
      .eq("event_id", candidateEventId);

    if (error) {
      console.error("[register] Failed to verify existing registration:", error.message);
      return null;
    }

    if (data && data.length > 0) {
      return data as ExistingRegistrationRow[];
    }
  }

  return [];
}

function resolveRequestedRegistrationStatus(
  remainingSpots: number,
): "confirmed" | "waitlist" {
  return remainingSpots > 0 ? "confirmed" : "waitlist";
}

function resolveRegistrationStatus(
  requestedStatus: "confirmed" | "waitlist",
  isPaid: boolean,
): "confirmed" | "pending" | "waitlist" {
  if (requestedStatus === "waitlist") {
    return "waitlist";
  }

  return isPaid ? "pending" : "confirmed";
}

export async function registerAttendee(
  supabase: SupabaseClient,
  payload: RegisterAttendeePayload,
): Promise<RegisterAttendeeResult> {
  const eventSlug = payload.eventSlug.trim();
  const fullName = payload.fullName.trim();
  const email = payload.email.trim().toLowerCase();

  if (!eventSlug || !fullName || !email) {
    return { ok: false, error: "Faltan campos obligatorios.", status: 400 };
  }

  if (!payload.privacyAccepted) {
    return { ok: false, error: "Debes aceptar la política de privacidad para registrarte.", status: 400 };
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select(
      "id,title,slug,event_date,event_time,location,capacity,is_paid,price,waitlist_enabled,is_published",
    )
    .eq("slug", eventSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (eventError) {
    console.error("[register] Failed to load event:", eventError.message);
    return { ok: false, error: "No se pudo cargar este evento.", status: 500 };
  }

  if (!eventRow) {
    return { ok: false, error: "Evento no encontrado.", status: 404 };
  }

  const event = eventRow as EventRow;
  const eventId = event.id;
  const isPaid = Boolean(event.is_paid ?? (Number(event.price ?? 0) > 0));
  const capacity = event.capacity ?? 0;
  const waitlistEnabled = event.waitlist_enabled ?? true;

  const { data: countData, error: countError } = await supabase.rpc(
    "get_event_registration_counts",
    { p_event_id: Number(eventId) },
  );

  if (countError) {
    console.error("[register] Failed to load registration counts:", countError.message);
    return { ok: false, error: "No se pudo cargar la disponibilidad del evento.", status: 500 };
  }

  const counts = (countData ?? { confirmed: 0, pending: 0 }) as {
    confirmed?: number;
    pending?: number;
  };
  const confirmedCount = Number(counts.confirmed ?? 0);
  const pendingCount = Number(counts.pending ?? 0);
  const occupiedCount = isPaid ? confirmedCount + pendingCount : confirmedCount;
  const remainingSpots = Math.max(capacity - occupiedCount, 0);
  const availabilityStatus = getEventStatus(capacity, confirmedCount, waitlistEnabled, {
    pendingCount,
    isPaidEvent: isPaid,
  });

  const privacyAcceptedAt = payload.privacyAccepted ? new Date().toISOString() : null;

  const { data: existingClient, error: existingClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existingClientError) {
    console.error("[register] Failed to verify client profile:", existingClientError.message);
    return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
  }

  let clientId = existingClient?.[0]?.id as string | number | undefined;

  if (clientId) {
    const { error: updateClientError } = await supabase
      .from("clients")
      .update({
        full_name: fullName,
        email,
        phone: payload.phone || null,
        marketing_consent: payload.marketingConsent,
        privacy_accepted: payload.privacyAccepted,
        privacy_accepted_at: privacyAcceptedAt,
      })
      .eq("id", clientId);

    if (updateClientError) {
      console.error("[register] Failed to update client profile:", updateClientError.message);
      return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
    }
  } else {
    const { data: insertedClient, error: insertClientError } = await supabase
      .from("clients")
      .insert({
        full_name: fullName,
        email,
        phone: payload.phone || null,
        marketing_consent: payload.marketingConsent,
        privacy_accepted: payload.privacyAccepted,
        privacy_accepted_at: privacyAcceptedAt,
      })
      .select("id")
      .single();

    if (insertClientError || !insertedClient?.id) {
      console.error("[register] Failed to create client profile:", insertClientError?.message);
      return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
    }

    clientId = insertedClient.id as string | number;
  }

  let existingRegistrations: ExistingRegistrationRow[] | null = await loadExistingRegistrations(
    supabase,
    clientId,
    eventId,
  );

  if (existingRegistrations === null) {
    return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
  }

  const activeRegistration = pickLatestRegistration(
    existingRegistrations.filter((registration) =>
      isActiveRegistrationStatus(registration.status),
    ),
  );
  const cancelledRegistration = pickLatestRegistration(
    existingRegistrations.filter((registration) =>
      isInactiveRegistrationStatus(registration.status),
    ),
  );

  if (activeRegistration?.id) {
    const activeStatus = activeRegistration.status;

    if (isPendingPaymentStatus(activeStatus) && isPaid) {
      return {
        ok: true,
        registrationStatus: "pending",
        registrationId: String(activeRegistration.id),
        resumePayment: true,
        event: buildEventPayload(event, eventSlug, isPaid),
      };
    }

    if (normalizeRegistrationStatus(activeStatus) === "waitlist") {
      return {
        ok: false,
        error: REGISTRATION_ALREADY_WAITLISTED_ERROR,
        status: 409,
      };
    }

    return {
      ok: false,
      error: REGISTRATION_ALREADY_REGISTERED_ERROR,
      status: 409,
    };
  }

  if (remainingSpots <= 0 && !waitlistEnabled) {
    return {
      ok: false,
      error: "Este evento está agotado y la lista de espera no está activada.",
      status: 400,
    };
  }

  const requestedRegistrationStatus = resolveRequestedRegistrationStatus(remainingSpots);

  if (
    requestedRegistrationStatus === "waitlist" &&
    availabilityStatus === "Sold out" &&
    !waitlistEnabled
  ) {
    return {
      ok: false,
      error: "Este evento está agotado y la lista de espera no está activada.",
      status: 400,
    };
  }

  const registrationStatus = resolveRegistrationStatus(requestedRegistrationStatus, isPaid);
  const paymentStatus = resolveRegistrationPaymentStatus(registrationStatus, isPaid);
  const eventPayload = buildEventPayload(event, eventSlug, isPaid);

  if (cancelledRegistration?.id) {
    const { data: reactivatedRegistration, error: reactivateError } = await supabase
      .from("registrations")
      .update({
        status: registrationStatus,
        payment_status: paymentStatus,
      })
      .eq("id", cancelledRegistration.id)
      .select("id")
      .single();

    if (reactivateError || !reactivatedRegistration?.id) {
      console.error(
        "[register] Failed to reactivate cancelled registration:",
        reactivateError?.message,
      );
      return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
    }

    return {
      ok: true,
      registrationStatus:
        registrationStatus === "waitlist" ? "waitlist" : registrationStatus,
      registrationId: String(reactivatedRegistration.id),
      event: eventPayload,
    };
  }

  const { data: insertedRegistration, error: registrationError } = await supabase
    .from("registrations")
    .insert({
      client_id: clientId,
      event_id: eventId,
      status: registrationStatus,
      payment_status: paymentStatus,
    })
    .select("id")
    .single();

  if (registrationError || !insertedRegistration?.id) {
    console.error("[register] Failed to insert registration:", registrationError?.message);
    return { ok: false, error: "No se pudo completar la inscripción. Inténtalo de nuevo.", status: 500 };
  }

  return {
    ok: true,
    registrationStatus:
      registrationStatus === "waitlist" ? "waitlist" : registrationStatus,
    registrationId: String(insertedRegistration.id),
    event: eventPayload,
  };
}
