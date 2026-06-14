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

    return Response.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[email] send-confirmation route failed:", error);
    return Response.json({ error: "Failed to send confirmation email." }, { status: 500 });
  }
}
