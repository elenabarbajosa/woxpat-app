import { Resend } from "resend";
import { formatDisplayEventTime } from "@/lib/date-utils";
import { buildConfirmationEmailFooterHtml } from "@/lib/email/confirmation-email-footer";
import { getEmailFromAddress } from "@/lib/email/get-from-address";

export type SendEventConfirmationEmailParams = {
  to: string;
  firstName: string;
  lastName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string | null;
  eventLocation?: string | null;
  isPaid: boolean;
  amount?: number | null;
};

export type SendEventConfirmationEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

function buildEmailHtml(params: SendEventConfirmationEmailParams): string {
  const greetingName = params.firstName.trim() || "asistente";
  const formattedTime = formatDisplayEventTime(params.eventTime);
  const timeRow = formattedTime ? `<p><strong>Hora:</strong> ${formattedTime}</p>` : "";
  const locationRow = params.eventLocation?.trim()
    ? `<p><strong>Ubicación:</strong> ${params.eventLocation.trim()}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; max-width: 560px;">
      <p>Hola ${greetingName},</p>
      <p>¡Tu inscripción al evento <strong>${params.eventName}</strong> ha quedado confirmada!</p>
      <p><strong>Evento:</strong> ${params.eventName}</p>
      <p><strong>Fecha:</strong> ${params.eventDate}</p>
      ${timeRow}
      ${locationRow}
      ${buildConfirmationEmailFooterHtml()}
    </div>
  `;
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function sendEventConfirmationEmail(
  params: SendEventConfirmationEmailParams,
): Promise<SendEventConfirmationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const error = "Missing RESEND_API_KEY.";
    console.error("[email] Confirmation email failed:", error);
    return { success: false, error };
  }

  const from = getEmailFromAddress();
  const to = params.to.trim();

  if (!to) {
    const error = "Missing recipient email.";
    console.error("[email] Confirmation email failed:", error);
    return { success: false, error };
  }

  const resend = new Resend(apiKey);
  const subject = `Confirmación de inscripción: ${params.eventName}`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildEmailHtml(params),
    });

    if (error) {
      console.error("[email] Confirmation email failed:", {
        to,
        eventName: params.eventName,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    console.info("[email] Confirmation email sent:", {
      to,
      eventName: params.eventName,
      isPaid: params.isPaid,
      id: data?.id,
    });

    return { success: true, id: data?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Confirmation email failed:", {
      to,
      eventName: params.eventName,
      error: message,
    });
    return { success: false, error: message };
  }
}
