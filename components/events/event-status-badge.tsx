import { getAdminEventStatusLabel, getPublicEventStatusLabel } from "@/lib/labels";
import type { EventStatus } from "@/lib/types";

const statusStyles: Record<EventStatus, string> = {
  Open: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
  "Few spots left": "bg-amber-50 text-amber-950 ring-amber-200/80",
  "Waitlist only": "bg-indigo-50 text-indigo-950 ring-indigo-200/80",
  "Sold out": "bg-zinc-100 text-zinc-700 ring-zinc-300/80",
};

interface EventStatusBadgeProps {
  status: EventStatus;
  variant?: "public" | "admin";
}

export function EventStatusBadge({ status, variant = "admin" }: EventStatusBadgeProps) {
  const label =
    variant === "public" ? getPublicEventStatusLabel(status) : getAdminEventStatusLabel(status);

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
