import { sendAdminRegistrationNotificationEmail } from "@/lib/email/send-admin-registration-notification";
import {
  sendEventConfirmationEmail,
  splitFullName,
} from "@/lib/email/send-event-confirmation";

type SendConfirmationPayload = {
  fullName: string;
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string | null;
  eventLocation?: string | null;
  isPaid?: boolean;
  amount?: number | null;
  phone?: string | null;
  marketingConsent?: boolean;
  privacyAccepted?: boolean;
  registrationId?: string | number | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SendConfirmationPayload>;

    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const eventTitle = body.eventTitle?.trim();
    const eventDate = body.eventDate?.trim();

    if (!fullName || !email || !eventTitle || !eventDate) {
      return Response.json({ error: "Missing required email fields." }, { status: 400 });
    }

    const { firstName, lastName } = splitFullName(fullName);
    const result = await sendEventConfirmationEmail({
      to: email,
      firstName,
      lastName,
      eventName: eventTitle,
      eventDate,
      eventTime: body.eventTime,
      eventLocation: body.eventLocation,
      isPaid: Boolean(body.isPaid),
      amount: body.amount ?? null,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    const adminResult = await sendAdminRegistrationNotificationEmail({
      eventTitle,
      eventDate,
      eventTime: body.eventTime,
      eventLocation: body.eventLocation,
      firstName,
      lastName,
      email,
      phone: body.phone,
      marketingConsent: body.marketingConsent,
      privacyAccepted: body.privacyAccepted,
      isPaid: Boolean(body.isPaid),
      amount: body.amount ?? null,
      registrationId: body.registrationId,
    });

    if (!adminResult.success) {
      console.error("[email] Attendee confirmation sent but admin notification failed:", {
        eventTitle,
        attendeeEmail: email,
        error: adminResult.error,
      });
    }

    return Response.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[email] send-confirmation route failed:", error);
    return Response.json({ error: "Failed to send confirmation email." }, { status: 500 });
  }
}
