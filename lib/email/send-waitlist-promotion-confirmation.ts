import { Resend } from "resend";

export type SendWaitlistPromotionConfirmationParams = {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string | null;
  eventLocation?: string | null;
};

export type SendWaitlistPromotionConfirmationResult =
  | { success: true; id: string }
  | { success: false; error: string };

function buildWaitlistPromotionHtml(params: SendWaitlistPromotionConfirmationParams): string {
  const greetingName = params.recipientName.trim() || "asistente";
  const eventName = params.eventName.trim() || "tu evento";
  const eventDate = params.eventDate.trim() || "próximamente";
  const eventTime = params.eventTime?.trim();
  const scheduleLine = eventTime
    ? `Te esperamos el ${eventDate} a las ${eventTime}.`
    : `Te esperamos el ${eventDate}.`;
  const locationLine = params.eventLocation?.trim()
    ? `<p><strong>Ubicación:</strong> ${params.eventLocation.trim()}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; max-width: 560px;">
      <p>Hola ${greetingName},</p>
      <p>Se ha liberado una plaza para <strong>${eventName}</strong> y tu inscripción ha pasado de lista de espera a confirmada.</p>
      <p>${scheduleLine}</p>
      ${locationLine}
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p>Gracias,<br /><strong>Woxpat</strong></p>
    </div>
  `;
}

export async function sendWaitlistPromotionConfirmationEmail(
  params: SendWaitlistPromotionConfirmationParams,
): Promise<SendWaitlistPromotionConfirmationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const error = "Missing RESEND_API_KEY.";
    console.error("[email] Waitlist promotion confirmation failed:", error);
    return { success: false, error };
  }

  const from = process.env.EMAIL_FROM?.trim() ?? "Woxpat <hola@woxpat.com>";
  const to = params.to.trim();

  if (!to) {
    const error = "Missing recipient email.";
    console.error("[email] Waitlist promotion confirmation failed:", error);
    return { success: false, error };
  }

  const eventName = params.eventName.trim() || "tu evento";
  const resend = new Resend(apiKey);
  const subject = `Tu plaza para ${eventName} está confirmada`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildWaitlistPromotionHtml(params),
    });

    if (error) {
      console.error("[email] Waitlist promotion confirmation failed:", {
        to,
        eventName,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    console.info("[email] Waitlist promotion confirmation sent:", {
      to,
      eventName,
      id: data?.id,
    });

    return { success: true, id: data?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Waitlist promotion confirmation failed:", {
      to,
      eventName,
      error: message,
    });
    return { success: false, error: message };
  }
}
