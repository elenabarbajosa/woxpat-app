import { Resend } from "resend";
import { formatDisplayEventTime } from "@/lib/date-utils";

export type SendAdminRegistrationNotificationEmailParams = {
  eventTitle: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  marketingConsent?: boolean | null;
  privacyAccepted?: boolean | null;
  isPaid: boolean;
  amount?: number | null;
  registrationId?: string | number | null;
};

export type SendAdminRegistrationNotificationEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "—";
}

function buildEmailHtml(params: SendAdminRegistrationNotificationEmailParams): string {
  const eventTitle = params.eventTitle.trim() || "Evento sin título";
  const dateRow = params.eventDate?.trim()
    ? `<p><strong>Fecha:</strong> ${params.eventDate.trim()}</p>`
    : "";
  const formattedTime = formatDisplayEventTime(params.eventTime);
  const timeRow = formattedTime ? `<p><strong>Hora:</strong> ${formattedTime}</p>` : "";
  const locationRow = params.eventLocation?.trim()
    ? `<p><strong>Ubicación:</strong> ${params.eventLocation.trim()}</p>`
    : "";
  const phoneRow = params.phone?.trim()
    ? `<p><strong>Teléfono:</strong> ${params.phone.trim()}</p>`
    : "";
  const registrationIdRow =
    params.registrationId != null
      ? `<p><strong>ID de inscripción:</strong> ${params.registrationId}</p>`
      : "";
  const paymentType = params.isPaid ? "De pago" : "Gratuito";
  const amountRow =
    params.isPaid && params.amount != null
      ? `<p><strong>Importe:</strong> ${formatAmount(params.amount)}</p>`
      : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; max-width: 560px;">
      <p>Se ha registrado un nuevo asistente en Woxpat.</p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p><strong>Evento:</strong> ${eventTitle}</p>
      ${dateRow}
      ${timeRow}
      ${locationRow}
      <p><strong>Tipo de evento:</strong> ${paymentType}</p>
      ${amountRow}
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p><strong>Nombre:</strong> ${params.firstName.trim() || "—"}</p>
      <p><strong>Apellidos:</strong> ${params.lastName.trim() || "—"}</p>
      <p><strong>Email:</strong> ${params.email?.trim() || "—"}</p>
      ${phoneRow}
      <p><strong>Consentimiento marketing:</strong> ${formatBoolean(params.marketingConsent)}</p>
      <p><strong>Política de privacidad aceptada:</strong> ${formatBoolean(params.privacyAccepted)}</p>
      ${registrationIdRow}
    </div>
  `;
}

export async function sendAdminRegistrationNotificationEmail(
  params: SendAdminRegistrationNotificationEmailParams,
): Promise<SendAdminRegistrationNotificationEmailResult> {
  const adminNotificationConfigured = Boolean(process.env.ADMIN_NOTIFICATION_EMAIL?.trim());
  console.info("[email] ADMIN_NOTIFICATION_EMAIL configured:", adminNotificationConfigured ? "yes" : "no");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const error = "Missing RESEND_API_KEY.";
    console.error("[email] Admin notification failed:", error);
    return { success: false, error };
  }

  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!to) {
    const error = "Missing ADMIN_NOTIFICATION_EMAIL.";
    console.warn("[email] Admin notification skipped:", error);
    return { success: false, error };
  }

  const from = process.env.EMAIL_FROM?.trim() ?? "Woxpat <hola@woxpat.com>";
  const attendeeEmail = params.email?.trim() ?? "";

  if (!attendeeEmail) {
    const error = "Missing attendee email.";
    console.error("[email] Admin notification failed:", error);
    return { success: false, error };
  }

  const eventTitle = params.eventTitle.trim() || "Evento Woxpat";
  const resend = new Resend(apiKey);
  const subject = `Nueva inscripción: ${eventTitle}`;

  console.info("[email] Attempting to send admin notification:", {
    eventTitle,
    isPaid: params.isPaid,
  });

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildEmailHtml(params),
    });

    if (error) {
      console.error("[email] Admin notification failed:", {
        eventTitle,
        attendeeEmail,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    console.info("[email] Admin notification sent successfully:", {
      eventTitle,
      attendeeEmail,
      isPaid: params.isPaid,
      id: data?.id,
    });

    return { success: true, id: data?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Admin notification failed:", {
      eventTitle,
      attendeeEmail,
      error: message,
    });
    return { success: false, error: message };
  }
}
