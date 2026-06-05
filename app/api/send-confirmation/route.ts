import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendConfirmationPayload = {
  fullName: string;
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  registrationStatus: "confirmed" | "waitlist";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SendConfirmationPayload>;

    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const eventTitle = body.eventTitle?.trim();
    const eventDate = body.eventDate?.trim();
    const eventTime = body.eventTime?.trim();
    const eventLocation = body.eventLocation?.trim();
    const registrationStatus = body.registrationStatus;

    if (
      !fullName ||
      !email ||
      !eventTitle ||
      !eventDate ||
      !eventTime ||
      !eventLocation ||
      (registrationStatus !== "confirmed" && registrationStatus !== "waitlist")
    ) {
      return Response.json({ error: "Missing required email fields." }, { status: 400 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Woxpat <onboarding@resend.dev>";
    const statusLabel =
      registrationStatus === "confirmed"
        ? "Your registration is confirmed."
        : "You are currently on the waitlist.";

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Woxpat registration: ${eventTitle}`,
      html: `
        <p>Hi ${fullName},</p>
        <p>Thanks for registering with Woxpat.</p>
        <p><strong>${statusLabel}</strong></p>
        <hr />
        <p><strong>Event:</strong> ${eventTitle}</p>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p><strong>Time:</strong> ${eventTime}</p>
        <p><strong>Location:</strong> ${eventLocation}</p>
        <p><strong>Status:</strong> ${registrationStatus}</p>
      `,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to send confirmation email." }, { status: 500 });
  }
}
