export type RegistrationPaymentStatus = "pending" | "paid" | "failed" | null;

export const REGISTRATION_USER_ERROR =
  "No se pudo completar la inscripción. Inténtalo de nuevo.";

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
