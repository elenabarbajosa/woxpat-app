import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { isPaidEventFromFlags } from "@/lib/event-capacity";
import { labels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  promoteNextWaitlistedRegistration,
  shouldPromoteAfterCancellation,
  type PromotionEvent,
} from "@/lib/waitlist-promotion";

type CancelRegistrationBody = {
  registrationId?: string;
};

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user || !isAllowedAdminEmail(user.email)) {
    return Response.json(
      { ok: false, level: "error", message: "No autorizado." },
      { status: 401 },
    );
  }

  let body: Partial<CancelRegistrationBody>;
  try {
    body = (await request.json()) as Partial<CancelRegistrationBody>;
  } catch {
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 400 },
    );
  }

  const registrationId = body.registrationId?.trim();
  if (!registrationId) {
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 400 },
    );
  }

  let serviceSupabase;
  try {
    serviceSupabase = createServiceClient();
  } catch {
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 500 },
    );
  }

  const candidateRegistrationId = Number.isFinite(Number(registrationId))
    ? Number(registrationId)
    : registrationId;

  const { data: registrationRow, error: registrationError } = await serviceSupabase
    .from("registrations")
    .select("id,event_id,status")
    .eq("id", candidateRegistrationId)
    .maybeSingle();

  if (registrationError || !registrationRow) {
    console.error("[admin] Failed to load registration for cancel:", registrationError?.message);
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 404 },
    );
  }

  const currentStatus = registrationRow.status;
  if (currentStatus === "cancelled") {
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 400 },
    );
  }

  const { data: eventRow, error: eventError } = await serviceSupabase
    .from("events")
    .select(
      "id,title,slug,event_date,event_time,location,capacity,is_paid,price",
    )
    .eq("id", registrationRow.event_id)
    .maybeSingle();

  if (eventError || !eventRow) {
    console.error("[admin] Failed to load event for cancel:", eventError?.message);
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 500 },
    );
  }

  const isPaidEvent = isPaidEventFromFlags(eventRow.is_paid, eventRow.price);

  const { error: cancelError } = await serviceSupabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", candidateRegistrationId);

  if (cancelError) {
    console.error("[admin] Failed to cancel registration:", cancelError.message);
    return Response.json(
      { ok: false, level: "error", message: labels.couldNotCancelRegistration },
      { status: 500 },
    );
  }

  if (!shouldPromoteAfterCancellation(currentStatus, isPaidEvent)) {
    return Response.json({
      ok: true,
      level: "success",
      message: labels.cancelRegistrationDone,
      promoted: false,
      emailSent: false,
    });
  }

  const promotionResult = await promoteNextWaitlistedRegistration({
    supabase: serviceSupabase,
    event: eventRow as PromotionEvent,
  });

  return Response.json(
    {
      ok: promotionResult.ok,
      level: promotionResult.level,
      message: promotionResult.message,
      promoted: promotionResult.promoted,
      emailSent: promotionResult.emailSent,
      registrationId: promotionResult.registrationId,
    },
    { status: promotionResult.ok ? 200 : promotionResult.level === "warning" ? 200 : 400 },
  );
}
