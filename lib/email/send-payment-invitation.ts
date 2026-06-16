import { Resend } from "resend";

export type SendPaymentInvitationEmailParams = {
  to: string;
  recipientName: string;
  eventName: string;
  paymentUrl: string;
};

export type SendPaymentInvitationEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

function buildPaymentInvitationHtml(params: SendPaymentInvitationEmailParams): string {
  const greetingName = params.recipientName.trim() || "asistente";

  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; max-width: 560px;">
      <p>Hola ${greetingName},</p>
      <p>Se ha liberado una plaza para <strong>${params.eventName}</strong>.</p>
      <p>Para confirmar tu plaza, completa el pago aquí:</p>
      <p><a href="${params.paymentUrl}" style="color: #18181b; font-weight: bold;">${params.paymentUrl}</a></p>
      <p>Tu plaza solo quedará confirmada después del pago.</p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p>El equipo de Woxpat</p>
    </div>
  `;
}

export async function sendPaymentInvitationEmail(
  params: SendPaymentInvitationEmailParams,
): Promise<SendPaymentInvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const error = "Missing RESEND_API_KEY.";
    console.error("[email] Payment invitation failed:", error);
    return { success: false, error };
  }

  const from = process.env.EMAIL_FROM?.trim() ?? "Woxpat <hola@woxpat.com>";
  const to = params.to.trim();

  if (!to) {
    const error = "Missing recipient email.";
    console.error("[email] Payment invitation failed:", error);
    return { success: false, error };
  }

  const eventName = params.eventName.trim() || "tu evento";
  const resend = new Resend(apiKey);
  const subject = `Se ha liberado una plaza para ${eventName}`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildPaymentInvitationHtml(params),
    });

    if (error) {
      console.error("[email] Payment invitation failed:", {
        to,
        eventName,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    console.info("[email] Payment invitation sent:", {
      to,
      eventName,
      id: data?.id,
    });

    return { success: true, id: data?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Payment invitation failed:", {
      to,
      eventName,
      error: message,
    });
    return { success: false, error: message };
  }
}
