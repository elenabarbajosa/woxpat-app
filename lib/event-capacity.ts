import type { SupabaseClient } from "@supabase/supabase-js";

export type EventRegistrationCounts = {
  confirmed: number;
  pending: number;
  waitlist: number;
};

export function isPaidEventFromFlags(
  isPaid: boolean | null | undefined,
  price: number | null | undefined,
): boolean {
  return Boolean(isPaid ?? (Number(price ?? 0) > 0));
}

export function getOccupiedSpots(
  counts: EventRegistrationCounts,
  isPaidEvent: boolean,
): number {
  if (isPaidEvent) {
    return counts.confirmed + counts.pending;
  }
  return counts.confirmed;
}

export function getRemainingSpots(
  capacity: number,
  counts: EventRegistrationCounts,
  isPaidEvent: boolean,
): number {
  return Math.max(capacity - getOccupiedSpots(counts, isPaidEvent), 0);
}

export function countsFromRegistrations(
  registrations: Array<{ status: string | null }>,
): EventRegistrationCounts {
  const counts: EventRegistrationCounts = { confirmed: 0, pending: 0, waitlist: 0 };

  for (const registration of registrations) {
    if (registration.status === "confirmed") counts.confirmed += 1;
    else if (registration.status === "pending") counts.pending += 1;
    else if (registration.status === "waitlist") counts.waitlist += 1;
  }

  return counts;
}

export async function fetchEventRegistrationCounts(
  supabase: SupabaseClient,
  eventId: string | number,
): Promise<EventRegistrationCounts | null> {
  const { data, error } = await supabase
    .from("registrations")
    .select("status")
    .eq("event_id", String(eventId))
    .in("status", ["confirmed", "pending", "waitlist"]);

  if (error) {
    console.error("[event-capacity] Failed to count registrations:", error.message);
    return null;
  }

  return countsFromRegistrations((data ?? []) as Array<{ status: string | null }>);
}

export async function fetchConfirmedCount(
  supabase: SupabaseClient,
  eventId: string | number,
  excludeRegistrationId?: string | number,
): Promise<number | null> {
  let query = supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", String(eventId))
    .eq("status", "confirmed");

  if (excludeRegistrationId != null) {
    query = query.neq("id", excludeRegistrationId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("[event-capacity] Failed to count confirmed registrations:", error.message);
    return null;
  }

  return count ?? 0;
}
