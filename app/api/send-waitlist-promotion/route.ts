import { sendWaitlistPromotionConfirmationEmail } from "@/lib/email/send-waitlist-promotion-confirmation";

type SendWaitlistPromotionBody = {
  fullName?: string;
  email?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string | null;
  eventLocation?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SendWaitlistPromotionBody>;

    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const eventTitle = body.eventTitle?.trim();
    const eventDate = body.eventDate?.trim();

    if (!fullName || !email || !eventTitle || !eventDate) {
      return Response.json({ error: "Missing required email fields." }, { status: 400 });
    }

    const result = await sendWaitlistPromotionConfirmationEmail({
      to: email,
      recipientName: fullName,
      eventName: eventTitle,
      eventDate,
      eventTime: body.eventTime,
      eventLocation: body.eventLocation,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[email] send-waitlist-promotion route failed:", error);
    return Response.json({ error: "Failed to send waitlist promotion email." }, { status: 500 });
  }
}
