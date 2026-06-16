import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchEventRegistrationCounts,
  getRemainingSpots,
  isPaidEventFromFlags,
} from "@/lib/event-capacity";
import { sendPaymentInvitationEmail } from "@/lib/email/send-payment-invitation";
import { createCheckoutSessionForRegistration } from "@/lib/stripe/create-checkout-session-for-registration";

export type WaitlistPaymentEvent = {
  id: string | number;
  title: string | null;
  slug: string | null;
  price: number | null;
  is_paid: boolean | null;
  capacity: number | null;
};

export type WaitlistPaymentClient = {
  full_name: string | null;
  email: string | null;
};

export type SendWaitlistPaymentLinkParams = {
  supabase: SupabaseClient;
  registrationId: string | number;
  event: WaitlistPaymentEvent;
  client: WaitlistPaymentClient;
  requireAvailableSpot?: boolean;
  resend?: boolean;
};

export type SendWaitlistPaymentLinkResult = {
  ok: boolean;
  level: "success" | "warning" | "error";
  message: string;
  registrationUpdated: boolean;
};

export const WAITLIST_PAYMENT_MESSAGES = {
  manualPaymentLinkSent: "Se ha enviado un enlace de pago a la persona en lista de espera.",
  paymentLinkResent: "Se ha reenviado el enlace de pago.",
  emailFailed:
    "La plaza se ha liberado, pero no se pudo enviar el email de pago. Revisa la configuración de email.",
  resendEmailFailed:
    "No se pudo reenviar el email de pago. Revisa la configuración de email.",
  checkoutFailed: "No se pudo generar el enlace de pago. Inténtalo de nuevo.",
  updateFailed: "No se pudo actualizar la inscripción. Inténtalo de nuevo.",
  missingEmail: "Esta persona no tiene email. No se puede enviar el enlace de pago.",
  notWaitlist: "Solo se puede enviar el enlace de pago a personas en lista de espera.",
  notPending: "Solo se puede reenviar el enlace a personas pendientes de pago.",
  notPaidEvent: "Este evento no es de pago.",
  noSpots:
    "No hay plazas disponibles. Ya hay una persona pendiente de pago para esta plaza.",
  invalidPrice: "El precio del evento no es válido.",
} as const;

async function createCheckoutAndSendEmail(params: {
  registrationId: string | number;
  event: WaitlistPaymentEvent;
  client: WaitlistPaymentClient;
  resend: boolean;
}): Promise<
  | { ok: true; registrationUpdated: boolean; emailSent: true }
  | { ok: false; level: "warning" | "error"; message: string; registrationUpdated: boolean }
> {
  const { registrationId, event, client, resend } = params;
  const price = Number(event.price ?? 0);
  const clientEmail = client.email?.trim() ?? "";
  const eventSlug = event.slug?.trim() ?? "";
  const eventTitle = event.title?.trim() ?? eventSlug;

  const checkoutResult = await createCheckoutSessionForRegistration({
    registrationId,
    eventSlug,
    eventTitle,
    price,
    clientEmail,
  });

  if (!checkoutResult.success) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.checkoutFailed,
      registrationUpdated: false,
    };
  }

  const emailResult = await sendPaymentInvitationEmail({
    to: clientEmail,
    recipientName: client.full_name?.trim() || "Asistente",
    eventName: eventTitle,
    paymentUrl: checkoutResult.url,
  });

  if (!emailResult.success) {
    return {
      ok: false,
      level: "warning",
      message: resend
        ? WAITLIST_PAYMENT_MESSAGES.resendEmailFailed
        : WAITLIST_PAYMENT_MESSAGES.emailFailed,
      registrationUpdated: !resend,
    };
  }

  return {
    ok: true,
    registrationUpdated: !resend,
    emailSent: true,
  };
}

export async function sendWaitlistPaymentLink(
  params: SendWaitlistPaymentLinkParams,
): Promise<SendWaitlistPaymentLinkResult> {
  const {
    supabase,
    registrationId,
    event,
    client,
    requireAvailableSpot = true,
    resend = false,
  } = params;

  if (!isPaidEventFromFlags(event.is_paid, event.price)) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.notPaidEvent,
      registrationUpdated: false,
    };
  }

  const price = Number(event.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.invalidPrice,
      registrationUpdated: false,
    };
  }

  const clientEmail = client.email?.trim() ?? "";
  if (!clientEmail) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.missingEmail,
      registrationUpdated: false,
    };
  }

  const eventSlug = event.slug?.trim() ?? "";
  const eventTitle = event.title?.trim() ?? eventSlug;
  if (!eventSlug || !eventTitle) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.checkoutFailed,
      registrationUpdated: false,
    };
  }

  const candidateRegistrationId = Number.isFinite(Number(registrationId))
    ? Number(registrationId)
    : registrationId;

  const { data: registrationRow, error: registrationError } = await supabase
    .from("registrations")
    .select("id,status,event_id")
    .eq("id", candidateRegistrationId)
    .maybeSingle();

  if (registrationError || !registrationRow) {
    console.error("[waitlist-payment] Failed to load registration:", registrationError?.message);
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.updateFailed,
      registrationUpdated: false,
    };
  }

  if (String(registrationRow.event_id) !== String(event.id)) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.updateFailed,
      registrationUpdated: false,
    };
  }

  if (resend) {
    if (registrationRow.status !== "pending") {
      return {
        ok: false,
        level: "error",
        message: WAITLIST_PAYMENT_MESSAGES.notPending,
        registrationUpdated: false,
      };
    }

    const checkoutAndEmail = await createCheckoutAndSendEmail({
      registrationId: candidateRegistrationId,
      event,
      client,
      resend: true,
    });

    if (!checkoutAndEmail.ok) {
      return {
        ok: false,
        level: checkoutAndEmail.level,
        message: checkoutAndEmail.message,
        registrationUpdated: false,
      };
    }

    return {
      ok: true,
      level: "success",
      message: WAITLIST_PAYMENT_MESSAGES.paymentLinkResent,
      registrationUpdated: false,
    };
  }

  if (registrationRow.status !== "waitlist") {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.notWaitlist,
      registrationUpdated: false,
    };
  }

  if (requireAvailableSpot) {
    const counts = await fetchEventRegistrationCounts(supabase, event.id);
    if (counts === null) {
      return {
        ok: false,
        level: "error",
        message: WAITLIST_PAYMENT_MESSAGES.updateFailed,
        registrationUpdated: false,
      };
    }

    const remainingSpots = getRemainingSpots(event.capacity ?? 0, counts, true);
    if (remainingSpots <= 0) {
      return {
        ok: false,
        level: "error",
        message: WAITLIST_PAYMENT_MESSAGES.noSpots,
        registrationUpdated: false,
      };
    }
  }

  const checkoutResult = await createCheckoutSessionForRegistration({
    registrationId: candidateRegistrationId,
    eventSlug,
    eventTitle,
    price,
    clientEmail,
  });

  if (!checkoutResult.success) {
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.checkoutFailed,
      registrationUpdated: false,
    };
  }

  const { error: updateError } = await supabase
    .from("registrations")
    .update({ status: "pending", payment_status: "pending" })
    .eq("id", candidateRegistrationId);

  if (updateError) {
    console.error("[waitlist-payment] Failed to update registration:", updateError.message);
    return {
      ok: false,
      level: "error",
      message: WAITLIST_PAYMENT_MESSAGES.updateFailed,
      registrationUpdated: false,
    };
  }

  const emailResult = await sendPaymentInvitationEmail({
    to: clientEmail,
    recipientName: client.full_name?.trim() || "Asistente",
    eventName: eventTitle,
    paymentUrl: checkoutResult.url,
  });

  if (!emailResult.success) {
    return {
      ok: false,
      level: "warning",
      message: WAITLIST_PAYMENT_MESSAGES.emailFailed,
      registrationUpdated: true,
    };
  }

  return {
    ok: true,
    level: "success",
    message: WAITLIST_PAYMENT_MESSAGES.manualPaymentLinkSent,
    registrationUpdated: true,
  };
}

export async function resendPendingPaymentLink(
  params: Omit<SendWaitlistPaymentLinkParams, "requireAvailableSpot" | "resend">,
): Promise<SendWaitlistPaymentLinkResult> {
  return sendWaitlistPaymentLink({ ...params, resend: true, requireAvailableSpot: false });
}
