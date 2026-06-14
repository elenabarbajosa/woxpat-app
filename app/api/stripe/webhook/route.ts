import {
  sendEventConfirmationEmail,
  splitFullName,
} from "@/lib/email/send-event-confirmation";
import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

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
  price: number | null;
};

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
    amount_total?: number | null;
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
        .select("id,title,slug,event_date,event_time,location,price")
        .eq("id", eventId)
        .maybeSingle(),
    ]);

  if (clientError || eventError || !clientRow || !eventRow) {
    console.error("Failed to fetch client/event:", { clientError, eventError });
    return Response.json({ error: "Failed to fetch confirmation details." }, { status: 500 });
  }

  const client = clientRow as SupabaseClientRow;
  const eventData = eventRow as SupabaseEventRow;
  const { firstName, lastName } = splitFullName(client.full_name ?? "");
  const amount =
    session.amount_total != null ? session.amount_total / 100 : Number(eventData.price ?? 0);

  const emailResult = await sendEventConfirmationEmail({
    to: client.email ?? "",
    firstName,
    lastName,
    eventName: eventData.title ?? eventData.slug ?? "Evento Woxpat",
    eventDate: eventData.event_date ?? "Por confirmar",
    eventTime: eventData.event_time,
    eventLocation: eventData.location,
    isPaid: true,
    amount,
  });

  if (!emailResult.success) {
    console.error("[email] Payment confirmed but confirmation email failed:", {
      registrationId: matchedRegistrationId,
      error: emailResult.error,
    });
  }

  return Response.json({ received: true });
}
