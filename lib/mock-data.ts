import { getEventAvailability, sortEventsForAdmin } from "./event-utils";
import type { Event, Registration } from "./types";

export const events: Event[] = [
  {
    id: "evt_1",
    slug: "lisbon-breakfast-circle",
    title: "Lisbon Breakfast Circle",
    date: "2026-05-06",
    time: "09:00",
    location: "Amelia Cafe, Lisbon",
    description:
      "A small morning meetup for women founders and operators to connect, share updates, and build meaningful local relationships.",
    category: "Breakfast",
    type: "Free",
    capacity: 8,
    confirmedCount: 5,
    waitlistEnabled: true,
    waitlistCount: 1,
    featured: true,
  },
  {
    id: "evt_2",
    slug: "porto-growth-brunch",
    title: "Porto Growth Brunch",
    date: "2026-05-18",
    time: "11:30",
    location: "Jardim Room, Porto",
    description:
      "A curated brunch focused on growth strategies, practical case studies, and peer support for women building modern businesses.",
    category: "Brunch",
    type: "Paid",
    capacity: 10,
    confirmedCount: 10,
    waitlistEnabled: true,
    waitlistCount: 4,
    featured: true,
  },
  {
    id: "evt_3",
    slug: "coimbra-brand-workshop",
    title: "Coimbra Brand Workshop",
    date: "2026-05-28",
    time: "16:00",
    location: "Atelier Norte, Coimbra",
    description:
      "Hands-on workshop to refine brand narrative, positioning, and messaging with guided exercises and collaborative feedback.",
    category: "Workshop",
    type: "Paid",
    capacity: 12,
    confirmedCount: 12,
    waitlistEnabled: false,
    waitlistCount: 0,
    featured: true,
  },
  {
    id: "evt_4",
    slug: "faro-community-networking",
    title: "Faro Community Networking Hour",
    date: "2026-06-04",
    time: "18:30",
    location: "Seaside Loft, Faro",
    description:
      "An after-work networking session for community members looking to meet potential collaborators and exchange opportunities.",
    category: "Networking",
    type: "Free",
    capacity: 14,
    confirmedCount: 6,
    waitlistEnabled: true,
    waitlistCount: 0,
  },
];

export const recentRegistrations: Registration[] = [
  {
    id: "reg_1",
    attendeeName: "Sofia Almeida",
    email: "sofia@woxpat.com",
    eventSlug: "porto-growth-brunch",
    status: "Waitlist",
    submittedAt: "2026-04-13 10:12",
  },
  {
    id: "reg_2",
    attendeeName: "Helena Costa",
    email: "helena@example.com",
    eventSlug: "lisbon-breakfast-circle",
    status: "Confirmed",
    submittedAt: "2026-04-13 09:03",
  },
  {
    id: "reg_3",
    attendeeName: "Marta Silva",
    email: "marta@example.com",
    eventSlug: "porto-growth-brunch",
    status: "Waitlist",
    submittedAt: "2026-04-12 18:47",
  },
  {
    id: "reg_4",
    attendeeName: "Ines Pereira",
    email: "ines@example.com",
    eventSlug: "faro-community-networking",
    status: "Confirmed",
    submittedAt: "2026-04-12 16:22",
  },
];

export function getFeaturedEvents(): Event[] {
  return events.filter((event) => event.featured).slice(0, 3);
}

export function getEventBySlug(slug: string): Event | undefined {
  return events.find((event) => event.slug === slug);
}

export function getAdminSummary() {
  const totalEvents = events.length;
  const totalRegistrations = events.reduce(
    (total, event) => total + event.confirmedCount + event.waitlistCount,
    0,
  );
  const confirmedAttendees = events.reduce(
    (total, event) => total + event.confirmedCount,
    0,
  );
  const waitlistCount = events.reduce(
    (total, event) => total + event.waitlistCount,
    0,
  );

  return {
    totalEvents,
    totalRegistrations,
    confirmedAttendees,
    waitlistCount,
  };
}

export function getAdminEvents() {
  return sortEventsForAdmin(events).map((event) => ({
    event,
    availability: getEventAvailability(event),
  }));
}
