import { Resend } from "resend";

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

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function buildEmailHtml(params: SendEventConfirmationEmailParams): string {
  const greetingName = params.firstName.trim() || "asistente";
  const timeRow = params.eventTime?.trim()
    ? `<p><strong>Hora:</strong> ${params.eventTime.trim()}</p>`
    : "";
  const locationRow = params.eventLocation?.trim()
    ? `<p><strong>Ubicación:</strong> ${params.eventLocation.trim()}</p>`
    : "";
  const paymentRow =
    params.isPaid && params.amount != null
      ? `<p><strong>Pago confirmado:</strong> ${formatAmount(params.amount)}</p>`
      : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; max-width: 560px;">
      <p>Hola ${greetingName},</p>
      <p>¡Tu inscripción al evento <strong>${params.eventName}</strong> ha quedado confirmada!</p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p><strong>Evento:</strong> ${params.eventName}</p>
      <p><strong>Fecha:</strong> ${params.eventDate}</p>
      ${timeRow}
      ${locationRow}
      ${paymentRow}
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p>Gracias por confiar en Woxpat. Nos encanta crear espacios donde las personas se conectan, aprenden y crecen juntas.</p>
      <p>Si tienes cualquier duda, responde a este correo y estaremos encantados de ayudarte.</p>
      <p>¡Nos vemos pronto!<br /><strong>El equipo de Woxpat</strong></p>
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

  const from = process.env.EMAIL_FROM?.trim() ?? "Woxpat <hola@woxpat.com>";
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
