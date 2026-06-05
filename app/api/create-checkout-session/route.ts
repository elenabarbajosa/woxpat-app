import { stripe } from "@/lib/stripe";

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) {
      return Response.json({ error: "Missing NEXT_PUBLIC_APP_URL." }, { status: 500 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
    }

    const unitAmount = Math.round(price * 100);
    const successUrl = `${appUrl}/events/${eventSlug}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/events/${eventSlug}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "eur",
      customer_email: clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: unitAmount,
            product_data: {
              name: eventTitle,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        registration_id: registrationId,
        event_slug: eventSlug,
      },
    });

    if (!session.url) {
      return Response.json({ error: "Stripe session did not return a redirect URL." }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Create checkout session failed:", error);
    return Response.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}

