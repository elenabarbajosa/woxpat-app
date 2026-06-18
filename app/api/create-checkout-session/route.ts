import { isPaidEventFromFlags } from "@/lib/event-capacity";
import { createCheckoutSessionForRegistration } from "@/lib/stripe/create-checkout-session-for-registration";
import { createServiceClient } from "@/lib/supabase/service";

type CreateCheckoutSessionBody = {
  registrationId: string;
  eventSlug: string;
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
  try {
    const body = (await request.json()) as Partial<CreateCheckoutSessionBody>;

    const registrationId = body.registrationId?.trim();
    const eventSlug = body.eventSlug?.trim();

    if (!registrationId || !eventSlug) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      return Response.json({ error: "Missing Supabase service role configuration." }, { status: 500 });
    }

    let registrationRow: {
      id: string | number;
      client_id: string | number | null;
      event_id: string | number | null;
      status: string | null;
    } | null = null;

    for (const candidateId of registrationIdCandidates(registrationId)) {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,client_id,event_id,status")
        .eq("id", candidateId)
        .maybeSingle();

      if (error) {
        console.error("[checkout] Failed to fetch registration:", error);
        return Response.json({ error: "Failed to verify registration." }, { status: 500 });
      }

      if (data) {
        registrationRow = data;
        break;
      }
    }

    if (!registrationRow) {
      return Response.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registrationRow.status !== "pending") {
      return Response.json({ error: "Registration is not pending payment." }, { status: 400 });
    }

    if (!registrationRow.event_id || !registrationRow.client_id) {
      return Response.json({ error: "Registration is incomplete." }, { status: 400 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("id,title,slug,is_paid,price")
      .eq("id", registrationRow.event_id)
      .maybeSingle();

    if (eventError || !eventRow) {
      console.error("[checkout] Failed to fetch event:", eventError);
      return Response.json({ error: "Failed to verify event." }, { status: 500 });
    }

    if ((eventRow.slug ?? "").trim() !== eventSlug) {
      return Response.json({ error: "Registration does not match this event." }, { status: 400 });
    }

    if (!isPaidEventFromFlags(eventRow.is_paid, eventRow.price)) {
      return Response.json({ error: "This event does not require payment." }, { status: 400 });
    }

    const price = Number(eventRow.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      return Response.json({ error: "Invalid event price." }, { status: 400 });
    }

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("email")
      .eq("id", registrationRow.client_id)
      .maybeSingle();

    if (clientError || !clientRow?.email?.trim()) {
      console.error("[checkout] Failed to fetch client email:", clientError);
      return Response.json({ error: "Failed to verify attendee email." }, { status: 500 });
    }

    const eventTitle = eventRow.title?.trim() || eventSlug;

    const result = await createCheckoutSessionForRegistration({
      registrationId: registrationRow.id,
      eventSlug,
      eventTitle,
      price,
      clientEmail: clientRow.email.trim(),
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ url: result.url });
  } catch (error) {
    console.error("Create checkout session failed:", error);
    return Response.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
