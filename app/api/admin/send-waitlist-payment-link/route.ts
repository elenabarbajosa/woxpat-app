import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  sendWaitlistPaymentLink,
  WAITLIST_PAYMENT_MESSAGES,
  type WaitlistPaymentClient,
  type WaitlistPaymentEvent,
} from "@/lib/waitlist-payment";

type SendWaitlistPaymentLinkBody = {
  registrationId?: string;
  requireAvailableSpot?: boolean;
  resend?: boolean;
  successMessage?: string;
};

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user || !isAllowedAdminEmail(user.email)) {
    return Response.json({ ok: false, level: "error", message: "No autorizado." }, { status: 401 });
  }

  let body: Partial<SendWaitlistPaymentLinkBody>;
  try {
    body = (await request.json()) as Partial<SendWaitlistPaymentLinkBody>;
  } catch {
    return Response.json(
      { ok: false, level: "error", message: WAITLIST_PAYMENT_MESSAGES.updateFailed },
      { status: 400 },
    );
  }

  const registrationId = body.registrationId?.trim();
  if (!registrationId) {
    return Response.json(
      { ok: false, level: "error", message: WAITLIST_PAYMENT_MESSAGES.updateFailed },
      { status: 400 },
    );
  }

  let serviceSupabase;
  try {
    serviceSupabase = createServiceClient();
  } catch {
    return Response.json(
      { ok: false, level: "error", message: WAITLIST_PAYMENT_MESSAGES.updateFailed },
      { status: 500 },
    );
  }

  const candidateRegistrationId = Number.isFinite(Number(registrationId))
    ? Number(registrationId)
    : registrationId;

  const { data: registrationRow, error: registrationError } = await serviceSupabase
    .from("registrations")
    .select("id,client_id,event_id,status")
    .eq("id", candidateRegistrationId)
    .maybeSingle();

  if (registrationError || !registrationRow) {
    console.error("[admin] Failed to load registration:", registrationError?.message);
    return Response.json(
      { ok: false, level: "error", message: WAITLIST_PAYMENT_MESSAGES.updateFailed },
      { status: 404 },
    );
  }

  const [{ data: eventRow, error: eventError }, { data: clientRow, error: clientError }] =
    await Promise.all([
      serviceSupabase
        .from("events")
        .select("id,title,slug,price,is_paid,capacity")
        .eq("id", registrationRow.event_id)
        .maybeSingle(),
      registrationRow.client_id
        ? serviceSupabase
            .from("clients")
            .select("full_name,email")
            .eq("id", registrationRow.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (eventError || !eventRow || clientError || !clientRow) {
    console.error("[admin] Failed to load event/client:", { eventError, clientError });
    return Response.json(
      { ok: false, level: "error", message: WAITLIST_PAYMENT_MESSAGES.updateFailed },
      { status: 500 },
    );
  }

  const result = await sendWaitlistPaymentLink({
    supabase: serviceSupabase,
    registrationId: candidateRegistrationId,
    event: eventRow as WaitlistPaymentEvent,
    client: clientRow as WaitlistPaymentClient,
    requireAvailableSpot: body.resend ? false : body.requireAvailableSpot !== false,
    resend: Boolean(body.resend),
  });

  const message =
    result.ok && body.successMessage?.trim()
      ? body.successMessage.trim()
      : result.message;

  return Response.json(
    {
      ok: result.ok,
      level: result.level,
      message,
      registrationUpdated: result.registrationUpdated,
    },
    { status: result.ok ? 200 : result.level === "warning" ? 200 : 400 },
  );
}
