import { sendAdminRegistrationNotificationEmail } from "@/lib/email/send-admin-registration-notification";
import {
  sendEventConfirmationEmail,
  splitFullName,
} from "@/lib/email/send-event-confirmation";
import { createServiceClient } from "@/lib/supabase/service";
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
  phone: string | null;
  marketing_consent: boolean | null;
  privacy_accepted: boolean | null;
};

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  price: number | null;
  capacity: number | null;
};

function registrationIdCandidates(registrationId: string): Array<string | number> {
  const candidates: Array<string | number> = [registrationId];
  const asNumber = Number(registrationId);
  if (Number.isFinite(asNumber)) {
    candidates.push(asNumber);
  }
  return candidates;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Missing Supabase service role configuration." }, { status: 500 });
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

  let matchedRegistrationId: string | number | null = null;
  let registrationRow: unknown = null;

  for (const candidateId of registrationIdCandidates(registrationId)) {
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

  if (registration.status === "cancelled") {
    console.warn("[stripe] Ignoring payment for cancelled registration:", {
      registrationId: matchedRegistrationId,
    });
    return Response.json({ received: true });
  }

  if (registration.status === "waitlist") {
    console.warn("[stripe] Ignoring payment for waitlist registration:", {
      registrationId: matchedRegistrationId,
    });
    return Response.json({ received: true });
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("id,title,slug,event_date,event_time,location,price,capacity")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !eventRow) {
    console.error("Failed to fetch event for payment confirmation:", eventError);
    return Response.json({ error: "Failed to fetch event." }, { status: 500 });
  }

  const eventData = eventRow as SupabaseEventRow;

  const wasAlreadyPaidAndConfirmed =
    registration.status === "confirmed" && registration.payment_status === "paid";

  if (!wasAlreadyPaidAndConfirmed) {
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", matchedRegistrationId);

    if (updateError) {
      console.error("Failed to update registration after payment:", updateError);
      return Response.json({ error: "Failed to update registration." }, { status: 500 });
    }
  }

  if (!wasAlreadyPaidAndConfirmed) {
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id,full_name,email,phone,marketing_consent,privacy_accepted")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      console.error("Failed to fetch client:", clientError);
      return Response.json({ error: "Failed to fetch confirmation details." }, { status: 500 });
    }

    const client = clientRow as SupabaseClientRow;
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

    const adminResult = await sendAdminRegistrationNotificationEmail({
      eventTitle: eventData.title ?? eventData.slug ?? "Evento Woxpat",
      eventDate: eventData.event_date,
      eventTime: eventData.event_time,
      eventLocation: eventData.location,
      firstName,
      lastName,
      email: client.email ?? "",
      phone: client.phone,
      marketingConsent: client.marketing_consent,
      privacyAccepted: client.privacy_accepted,
      isPaid: true,
      amount,
      registrationId: matchedRegistrationId,
    });

    if (!adminResult.success) {
      console.error("[email] Payment confirmed but admin notification failed:", {
        registrationId: matchedRegistrationId,
        error: adminResult.error,
      });
    }
  }

  return Response.json({ received: true });
}
