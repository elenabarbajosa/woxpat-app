/** Stored on events as the category display name (text); options come from `event_categories`. */
export type EventCategory = string;

export type EventType = "Free" | "Paid";

export type EventStatus = "Open" | "Few spots left" | "Waitlist only" | "Sold out";

export interface Event {
  id: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  category: EventCategory;
  type: EventType;
  capacity: number;
  confirmedCount: number;
  waitlistEnabled: boolean;
  waitlistCount: number;
  featured?: boolean;
}

export interface Registration {
  id: string;
  attendeeName: string;
  email: string;
  eventSlug: string;
  status: "Confirmed" | "Waitlist";
  submittedAt: string;
}

export interface EventAvailability {
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  remainingSpots: number;
  spotsLabel: string;
  occupancyRate: number;
  status: EventStatus;
}
