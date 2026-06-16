import { createCheckoutSessionForRegistration } from "@/lib/stripe/create-checkout-session-for-registration";

type CreateCheckoutSessionBody = {
  registrationId: string;
  eventSlug: string;
  eventTitle: string;
  price: number;
  clientEmail: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateCheckoutSessionBody>;

    const registrationId = body.registrationId?.trim();
    const eventSlug = body.eventSlug?.trim();
    const eventTitle = body.eventTitle?.trim();
    const clientEmail = body.clientEmail?.trim();
    const price = typeof body.price === "number" ? body.price : Number(body.price);

    if (!registrationId || !eventSlug || !eventTitle || !clientEmail) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return Response.json({ error: "Invalid price." }, { status: 400 });
    }

    const result = await createCheckoutSessionForRegistration({
      registrationId,
      eventSlug,
      eventTitle,
      price,
      clientEmail,
    });

    if (!result.success) {
      const status = result.error.includes("Missing") ? 500 : 500;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ url: result.url });
  } catch (error) {
    console.error("Create checkout session failed:", error);
    return Response.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
