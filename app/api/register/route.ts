import { registerAttendee } from "@/lib/register-attendee";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterBody = {
  eventSlug?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  marketingConsent?: boolean;
  privacyAccepted?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RegisterBody>;

    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      return Response.json({ error: "Registration is temporarily unavailable." }, { status: 500 });
    }

    const result = await registerAttendee(supabase, {
      eventSlug: body.eventSlug?.trim() ?? "",
      fullName: body.fullName?.trim() ?? "",
      email: body.email?.trim().toLowerCase() ?? "",
      phone: body.phone?.trim() ?? "",
      marketingConsent: Boolean(body.marketingConsent),
      privacyAccepted: Boolean(body.privacyAccepted),
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      registrationStatus: result.registrationStatus,
      registrationId: result.registrationId,
      resumePayment: result.resumePayment ?? false,
      event: result.event,
    });
  } catch (error) {
    console.error("[register] Route failed:", error);
    return Response.json({ error: "Failed to complete registration." }, { status: 500 });
  }
}
