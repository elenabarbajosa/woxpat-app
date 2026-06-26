export type RegistrationPaymentStatus = "pending" | "paid" | "failed" | null;

export const ACTIVE_REGISTRATION_STATUSES = [
  "confirmed",
  "pending",
  "pending_payment",
  "waitlist",
] as const;

export const INACTIVE_REGISTRATION_STATUSES = ["cancelled", "canceled"] as const;

export type ActiveRegistrationStatus = (typeof ACTIVE_REGISTRATION_STATUSES)[number];

export const REGISTRATION_USER_ERROR =
  "No se pudo completar la inscripción. Inténtalo de nuevo.";

export const REGISTRATION_ALREADY_REGISTERED_ERROR =
  "Ya estás registrado en este evento.";

export const REGISTRATION_ALREADY_WAITLISTED_ERROR =
  "Ya estás en la lista de espera para este evento.";

export function normalizeRegistrationStatus(
  status: string | null | undefined,
): string | null {
  const normalized = status?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function isActiveRegistrationStatus(status: string | null | undefined): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return (
    normalized !== null &&
    (ACTIVE_REGISTRATION_STATUSES as readonly string[]).includes(normalized)
  );
}

export function isInactiveRegistrationStatus(status: string | null | undefined): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return (
    normalized !== null &&
    (INACTIVE_REGISTRATION_STATUSES as readonly string[]).includes(normalized)
  );
}

export function isPendingPaymentStatus(status: string | null | undefined): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return normalized === "pending" || normalized === "pending_payment";
}

/**
 * Allowed by `registrations_payment_status_check`: pending, paid, failed, null.
 */
export function resolveRegistrationPaymentStatus(
  registrationStatus: "confirmed" | "pending" | "waitlist",
  isPaidEvent: boolean,
): RegistrationPaymentStatus {
  if (registrationStatus === "waitlist") {
    return null;
  }

  if (registrationStatus === "pending") {
    return "pending";
  }

  return isPaidEvent ? "pending" : "paid";
}

export function logRegistrationError(context: string, error: unknown) {
  const technical =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  console.error(`[registration] ${context}:`, technical);
}

export function registrationUserError(context: string, error: unknown): Error {
  logRegistrationError(context, error);
  return new Error(REGISTRATION_USER_ERROR);
}
