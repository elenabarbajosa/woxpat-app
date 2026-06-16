import { getAppOrigin } from "@/lib/app-url";
import { stripe } from "@/lib/stripe";

export type CreateCheckoutSessionForRegistrationParams = {
  registrationId: string | number;
  eventSlug: string;
  eventTitle: string;
  price: number;
  clientEmail: string;
};

export type CreateCheckoutSessionForRegistrationResult =
  | { success: true; url: string; sessionId: string }
  | { success: false; error: string };

export async function createCheckoutSessionForRegistration(
  params: CreateCheckoutSessionForRegistrationParams,
): Promise<CreateCheckoutSessionForRegistrationResult> {
  const registrationId = String(params.registrationId).trim();
  const eventSlug = params.eventSlug.trim();
  const eventTitle = params.eventTitle.trim();
  const clientEmail = params.clientEmail.trim();
  const price = params.price;

  if (!registrationId || !eventSlug || !eventTitle || !clientEmail) {
    return { success: false, error: "Missing required checkout fields." };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { success: false, error: "Invalid price." };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: "Missing STRIPE_SECRET_KEY." };
  }

  const appUrl = getAppOrigin();
  if (!appUrl) {
    return { success: false, error: "Missing NEXT_PUBLIC_APP_URL." };
  }

  const unitAmount = Math.round(price * 100);
  const successUrl = `${appUrl}/events/${eventSlug}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/events/${eventSlug}`;

  try {
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
      return { success: false, error: "Stripe session did not return a redirect URL." };
    }

    return { success: true, url: session.url, sessionId: session.id };
  } catch (error) {
    console.error("[stripe] Create checkout session failed:", error);
    return { success: false, error: "Failed to create checkout session." };
  }
}
