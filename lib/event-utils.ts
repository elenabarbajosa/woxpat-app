import { getAdminSpotsLabel } from "./labels";
import { getOccupiedSpots, getRemainingSpots, isPaidEventFromFlags } from "./event-capacity";
import type { Event, EventAvailability, EventStatus } from "./types";

const FEW_SPOTS_THRESHOLD = 3;

export function getEventStatus(
  capacity: number,
  confirmedCount: number,
  waitlistEnabled: boolean,
  options?: { pendingCount?: number; isPaidEvent?: boolean },
): EventStatus {
  const isPaidEvent = options?.isPaidEvent ?? false;
  const pendingCount = options?.pendingCount ?? 0;
  const occupied = isPaidEvent ? confirmedCount + pendingCount : confirmedCount;
  const remainingSpots = Math.max(capacity - occupied, 0);
  const isFull = remainingSpots === 0;

  if (isFull && waitlistEnabled) return "Waitlist only";
  if (isFull && !waitlistEnabled) return "Sold out";
  if (remainingSpots <= FEW_SPOTS_THRESHOLD) return "Few spots left";
  return "Open";
}

export function getEventAvailability(event: Event): EventAvailability {
  const isPaidEvent = event.type === "Paid";
  const counts = {
    confirmed: event.confirmedCount,
    pending: event.pendingCount,
    waitlist: event.waitlistCount,
  };
  const remainingSpots = getRemainingSpots(event.capacity, counts, isPaidEvent);
  const status = getEventStatus(event.capacity, event.confirmedCount, event.waitlistEnabled, {
    pendingCount: event.pendingCount,
    isPaidEvent,
  });
  const occupiedCount = getOccupiedSpots(counts, isPaidEvent);

  return {
    capacity: event.capacity,
    confirmedCount: event.confirmedCount,
    pendingCount: event.pendingCount,
    waitlistCount: event.waitlistCount,
    remainingSpots,
    spotsLabel: getAdminSpotsLabel(remainingSpots, event.capacity),
    occupancyRate: event.capacity > 0 ? Math.round((occupiedCount / event.capacity) * 100) : 0,
    status,
  };
}

export function getStatusPriority(status: EventStatus): number {
  switch (status) {
    case "Waitlist only":
      return 0;
    case "Sold out":
      return 1;
    case "Few spots left":
      return 2;
    case "Open":
      return 3;
  }
}

export function sortEventsForAdmin(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const aAvailability = getEventAvailability(a);
    const bAvailability = getEventAvailability(b);

    const priorityDiff =
      getStatusPriority(aAvailability.status) - getStatusPriority(bAvailability.status);
    if (priorityDiff !== 0) return priorityDiff;

    if (aAvailability.status === "Open" && bAvailability.status === "Open") {
      return bAvailability.remainingSpots - aAvailability.remainingSpots;
    }

    return a.date.localeCompare(b.date);
  });
}

export { isPaidEventFromFlags };
