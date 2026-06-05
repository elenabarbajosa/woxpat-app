import { getAdminSpotsLabel } from "./labels";
import type { Event, EventAvailability, EventStatus } from "./types";

const FEW_SPOTS_THRESHOLD = 3;

export function getEventStatus(
  capacity: number,
  confirmedCount: number,
  waitlistEnabled: boolean,
): EventStatus {
  const remainingSpots = Math.max(capacity - confirmedCount, 0);
  const isFull = remainingSpots === 0;

  if (isFull && waitlistEnabled) return "Waitlist only";
  if (isFull && !waitlistEnabled) return "Sold out";
  if (remainingSpots <= FEW_SPOTS_THRESHOLD) return "Few spots left";
  return "Open";
}

export function getEventAvailability(event: Event): EventAvailability {
  const remainingSpots = Math.max(event.capacity - event.confirmedCount, 0);
  const status = getEventStatus(
    event.capacity,
    event.confirmedCount,
    event.waitlistEnabled,
  );

  return {
    capacity: event.capacity,
    confirmedCount: event.confirmedCount,
    waitlistCount: event.waitlistCount,
    remainingSpots,
    spotsLabel: getAdminSpotsLabel(remainingSpots, event.capacity),
    occupancyRate: Math.round((event.confirmedCount / event.capacity) * 100),
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
