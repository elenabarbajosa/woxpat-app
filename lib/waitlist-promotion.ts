import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminRegistrationNotificationEmail } from "@/lib/email/send-admin-registration-notification";
import {
  sendEventConfirmationEmail,
  splitFullName,
} from "@/lib/email/send-event-confirmation";
import {
  fetchEventRegistrationCounts,
  getRemainingSpots,
  isPaidEventFromFlags,
} from "@/lib/event-capacity";
import { labels } from "@/lib/labels";
import { resolveRegistrationPaymentStatus } from "@/lib/registration-utils";
import {
  sendWaitlistPaymentLink,
  WAITLIST_PAYMENT_MESSAGES,
  type WaitlistPaymentClient,
  type WaitlistPaymentEvent,
} from "@/lib/waitlist-payment";

export type PromotionEvent = WaitlistPaymentEvent & {
  event_date: string | null;
  event_time: string | null;
  location: string | null;
};

export type PromoteWaitlistResult = {
  promoted: boolean;
  ok: boolean;
  level: "success" | "warning" | "error";
  message: string;
  emailSent: boolean;
  registrationId?: string | number;
};

export function shouldPromoteAfterCancellation(
  status: string | null | undefined,
  isPaidEvent: boolean,
): boolean {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "confirmed") return true;
  if (isPaidEvent && normalized === "pending") return true;
  return false;
}

export async function promoteNextWaitlistedRegistration(params: {
  supabase: SupabaseClient;
  event: PromotionEvent;
}): Promise<PromoteWaitlistResult> {
  const { supabase, event } = params;
  const isPaid = isPaidEventFromFlags(event.is_paid, event.price);

  const { data: waitlistRows, error: waitlistError } = await supabase
    .from("registrations")
    .select("id,client_id,created_at")
    .eq("event_id", String(event.id))
    .eq("status", "waitlist")
    .order("created_at", { ascending: true })
    .limit(1);

  if (waitlistError) {
    console.error("[waitlist-promotion] Failed to load waitlist:", waitlistError.message);
    return {
      promoted: false,
      ok: false,
      level: "error",
      message: labels.couldNotCancelRegistration,
      emailSent: false,
    };
  }

  if (!waitlistRows?.length) {
    return {
      promoted: false,
      ok: true,
      level: "success",
      message: labels.cancelRegistrationDone,
      emailSent: false,
    };
  }

  const counts = await fetchEventRegistrationCounts(supabase, event.id);
  if (counts === null) {
    return {
      promoted: false,
      ok: false,
      level: "error",
      message: labels.couldNotCancelRegistration,
      emailSent: false,
    };
  }

  const remainingSpots = getRemainingSpots(event.capacity ?? 0, counts, isPaid);
  if (remainingSpots <= 0) {
    return {
      promoted: false,
      ok: true,
      level: "success",
      message: labels.cancelRegistrationDone,
      emailSent: false,
    };
  }

  const firstWaitlist = waitlistRows[0] as {
    id: string | number;
    client_id: string | number | null;
  };

  if (!firstWaitlist.client_id) {
    console.error("[waitlist-promotion] Waitlist registration missing client_id:", firstWaitlist.id);
    return {
      promoted: false,
      ok: false,
      level: "error",
      message: labels.couldNotCancelRegistration,
      emailSent: false,
    };
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("full_name,email,phone,marketing_consent,privacy_accepted")
    .eq("id", firstWaitlist.client_id)
    .maybeSingle();

  if (clientError || !clientRow?.email?.trim()) {
    console.error("[waitlist-promotion] Failed to load client:", clientError?.message);
    return {
      promoted: false,
      ok: false,
      level: "error",
      message: labels.couldNotCancelRegistration,
      emailSent: false,
    };
  }

  if (isPaid) {
    const paymentResult = await sendWaitlistPaymentLink({
      supabase,
      registrationId: firstWaitlist.id,
      event,
      client: clientRow as WaitlistPaymentClient,
      requireAvailableSpot: false,
      resend: false,
    });

    if (!paymentResult.ok) {
      return {
        promoted: paymentResult.registrationUpdated,
        ok: false,
        level: paymentResult.level,
        message: paymentResult.message,
        emailSent: paymentResult.ok,
        registrationId: firstWaitlist.id,
      };
    }

    return {
      promoted: true,
      ok: true,
      level: paymentResult.level,
      message: labels.cancelRegistrationWaitlistPaymentSent,
      emailSent: paymentResult.level === "success",
      registrationId: firstWaitlist.id,
    };
  }

  const { error: promoteError } = await supabase
    .from("registrations")
    .update({
      status: "confirmed",
      payment_status: resolveRegistrationPaymentStatus("confirmed", false),
    })
    .eq("id", firstWaitlist.id);

  if (promoteError) {
    console.error("[waitlist-promotion] Failed to promote waitlist registration:", promoteError.message);
    return {
      promoted: false,
      ok: false,
      level: "error",
      message: labels.couldNotCancelRegistration,
      emailSent: false,
    };
  }

  const eventTitle = event.title?.trim() || event.slug?.trim() || "Evento";
  const eventDate = event.event_date?.trim() || "Por confirmar";
  const { firstName, lastName } = splitFullName(clientRow.full_name ?? "");

  const emailResult = await sendEventConfirmationEmail({
    to: clientRow.email.trim(),
    firstName,
    lastName,
    eventName: eventTitle,
    eventDate,
    eventTime: event.event_time,
    eventLocation: event.location,
    isPaid: false,
    amount: null,
  });

  if (!emailResult.success) {
    console.error("[waitlist-promotion] Confirmation email failed:", emailResult.error);
    return {
      promoted: true,
      ok: true,
      level: "warning",
      message: labels.cancelRegistrationWaitlistPromotedEmailFailed,
      emailSent: false,
      registrationId: firstWaitlist.id,
    };
  }

  const adminResult = await sendAdminRegistrationNotificationEmail({
    eventTitle,
    eventDate,
    eventTime: event.event_time,
    eventLocation: event.location,
    firstName,
    lastName,
    email: clientRow.email.trim(),
    phone: clientRow.phone,
    marketingConsent: clientRow.marketing_consent,
    privacyAccepted: clientRow.privacy_accepted,
    isPaid: false,
    amount: null,
    registrationId: firstWaitlist.id,
  });

  if (!adminResult.success) {
    console.error("[waitlist-promotion] Admin notification failed:", adminResult.error);
  }

  return {
    promoted: true,
    ok: true,
    level: "success",
    message: labels.cancelRegistrationWaitlistPromoted,
    emailSent: true,
    registrationId: firstWaitlist.id,
  };
}

export const WAITLIST_PROMOTION_MESSAGES = {
  noSpots: WAITLIST_PAYMENT_MESSAGES.noSpots,
} as const;
