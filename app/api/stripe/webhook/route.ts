import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

const resend = new Resend(process.env.RESEND_API_KEY);

type SupabaseRegistrationRow = {
  id: string | number;
  client_id: string | number | null;
  event_id: string | number | null;
  status: "pending" | "confirmed" | "waitlist" | "cancelled" | null;
  payment_status: string | null;
};

type SupabaseClientRow = {
  id: string | number;
  full_name: string | null;
  email: string | null;
};

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
};

async function sendConfirmationEmail(options: {
  fullName: string;
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  registrationStatus: "confirmed" | "waitlist";
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Woxpat <onboarding@resend.dev>";
  const statusLabel =
    options.registrationStatus === "confirmed"
      ? "Your registration is confirmed."
      : "You are currently on the waitlist.";

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: options.email,
    subject: `Woxpat registration: ${options.eventTitle}`,
    html: `
      <p>Hi ${options.fullName},</p>
      <p>Thanks for registering with Woxpat.</p>
      <p><strong>${statusLabel}</strong></p>
      <hr />
      <p><strong>Event:</strong> ${options.eventTitle}</p>
      <p><strong>Date:</strong> ${options.eventDate}</p>
      <p><strong>Time:</strong> ${options.eventTime}</p>
      <p><strong>Location:</strong> ${options.eventLocation}</p>
      <p><strong>Status:</strong> ${options.registrationStatus}</p>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email.");
  }
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as {
    metadata?: Record<string, string> | null;
    payment_status?: string | null;
  };

  if (session.payment_status !== "paid") {
    return Response.json({ received: true });
  }

  const registrationId = session.metadata?.registration_id;

  if (!registrationId) {
    return Response.json({ error: "Missing registration_id in metadata." }, { status: 400 });
  }

  const registrationIdNumber = Number(registrationId);
  const candidateIds: Array<string | number> = [registrationId];
  if (Number.isFinite(registrationIdNumber)) candidateIds.push(registrationIdNumber);

  let matchedRegistrationId: string | number | null = null;
  let registrationRow: unknown = null;

  for (const candidateId of candidateIds) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id,client_id,event_id,status,payment_status")
      .eq("id", candidateId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch registration:", error);
      return Response.json({ error: "Failed to fetch registration." }, { status: 500 });
    }

    if (data) {
      matchedRegistrationId = candidateId;
      registrationRow = data;
      break;
    }
  }

  if (!registrationRow || matchedRegistrationId === null) {
    return Response.json({ error: "Failed to fetch registration." }, { status: 500 });
  }

  const registration = registrationRow as SupabaseRegistrationRow;
  const clientId = registration.client_id;
  const eventId = registration.event_id;

  if (!clientId || !eventId) {
    return Response.json({ error: "Registration missing client_id or event_id." }, { status: 500 });
  }

  if (registration.status === "waitlist") {
    return Response.json({ received: true });
  }

  if (registration.status !== "confirmed" || registration.payment_status !== "paid") {
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", matchedRegistrationId);

    if (updateError) {
      console.error("Failed to update registration after payment:", updateError);
      return Response.json({ error: "Failed to update registration." }, { status: 500 });
    }
  }

  const [{ data: clientRow, error: clientError }, { data: eventRow, error: eventError }] =
    await Promise.all([
      supabase.from("clients").select("id,full_name,email").eq("id", clientId).maybeSingle(),
      supabase
        .from("events")
        .select("id,title,slug,event_date,event_time,location")
        .eq("id", eventId)
        .maybeSingle(),
    ]);

  if (clientError || eventError || !clientRow || !eventRow) {
    console.error("Failed to fetch client/event:", { clientError, eventError });
    return Response.json({ error: "Failed to fetch confirmation details." }, { status: 500 });
  }

  const client = clientRow as SupabaseClientRow;
  const eventData = eventRow as SupabaseEventRow;

  const registrationStatus = "confirmed" as const;

  try {
    await sendConfirmationEmail({
      fullName: client.full_name ?? "Guest",
      email: client.email ?? "",
      eventTitle: eventData.title ?? eventData.slug ?? "Woxpat event",
      eventDate: eventData.event_date ?? "TBD",
      eventTime: eventData.event_time ?? "TBD",
      eventLocation: eventData.location ?? "Location pending",
      registrationStatus,
    });
  } catch (emailError) {
    console.error("Confirmation email failed after payment:", emailError);
    return Response.json({ error: "Payment confirmed but email failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}

