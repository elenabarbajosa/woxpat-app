"use client";

import { useState, type FormEvent } from "react";
import { labels } from "@/lib/labels";

export interface RegistrationSubmitPayload {
  fullName: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  privacyAccepted: boolean;
}

interface RegistrationFormProps {
  eventTitle: string;
  onSubmit: (
    payload: RegistrationSubmitPayload,
  ) => Promise<{ registrationStatus: "confirmed" | "waitlist" | "pending" }>;
  isDisabled?: boolean;
  disabledMessage?: string;
  submitLabel?: string;
  submitNote?: string;
}

export function RegistrationForm({
  eventTitle,
  onSubmit,
  isDisabled = false,
  disabledMessage,
  submitLabel = labels.register,
  submitNote,
}: RegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phonePrefix, setPhonePrefix] = useState("+351");
  const [customCountryCode, setCustomCountryCode] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(formElement);
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

    let resolvedPrefix = phonePrefix.trim();
    if (!resolvedPrefix && phoneNumber) {
      const custom = customCountryCode.trim();
      if (!custom) {
        setErrorMessage("Please add your country code (e.g. +66).");
        setIsSubmitting(false);
        return;
      }
      if (!custom.startsWith("+")) {
        setErrorMessage("Country code must start with + (example: +66).");
        setIsSubmitting(false);
        return;
      }
      resolvedPrefix = custom;
    }

    if (phoneNumber && !resolvedPrefix) {
      setErrorMessage("Please select a country code before entering a phone number.");
      setIsSubmitting(false);
      return;
    }

    const combinedPhone = phoneNumber ? `${resolvedPrefix} ${phoneNumber}` : "";
    const payload: RegistrationSubmitPayload = {
      fullName: String(formData.get("fullName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      phone: combinedPhone,
      marketingConsent: Boolean(formData.get("marketingConsent")),
      privacyAccepted: Boolean(formData.get("privacyAccepted")),
    };

    if (!payload.privacyAccepted) {
      setErrorMessage("You must accept the privacy policy to register.");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await onSubmit(payload);
      if (result.registrationStatus === "pending") {
        setSuccessMessage("Continúa al pago para confirmar tu plaza.");
      } else {
        setSuccessMessage(
          result.registrationStatus === "confirmed"
            ? "Registro confirmado. ¡Nos vemos en el evento!"
            : "Te has apuntado a la lista de espera.",
        );
        formElement.reset();
        setPhonePrefix("+351");
        setCustomCountryCode("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not complete registration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">
        {labels.register} — {eventTitle}
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Completa el formulario para reservar tu plaza.
      </p>

      {disabledMessage ? <p className="mt-3 text-sm text-zinc-600">{disabledMessage}</p> : null}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-zinc-700">
            {labels.fullName}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            disabled={isDisabled || isSubmitting}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
            placeholder="Tu nombre completo"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
            {labels.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={isDisabled || isSubmitting}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            {labels.phone} (opcional)
          </label>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <select
              id="phonePrefix"
              name="phonePrefix"
              value={phonePrefix}
              onChange={(event) => setPhonePrefix(event.target.value)}
              disabled={isDisabled || isSubmitting}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
              aria-label="Country code"
            >
              <option value="+351">Portugal (+351)</option>
              <option value="+34">Spain (+34)</option>
              <option value="+1">United States (+1)</option>
              <option value="+44">United Kingdom (+44)</option>
              <option value="+33">France (+33)</option>
              <option value="+39">Italy (+39)</option>
              <option value="+49">Germany (+49)</option>
              <option value="+55">Brazil (+55)</option>
              <option value="+31">Netherlands (+31)</option>
              <option value="+353">Ireland (+353)</option>
              <option value="">Other</option>
            </select>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              disabled={isDisabled || isSubmitting}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
              placeholder="912 345 678"
            />
          </div>
          {!phonePrefix ? (
            <div className="mt-3">
              <label
                htmlFor="customCountryCode"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Custom country code
              </label>
              <input
                id="customCountryCode"
                name="customCountryCode"
                type="text"
                inputMode="text"
                autoComplete="tel-country-code"
                value={customCountryCode}
                onChange={(event) => setCustomCountryCode(event.target.value)}
                disabled={isDisabled || isSubmitting}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                placeholder="+66"
              />
              <p className="mt-1 text-xs text-zinc-500">Include the + prefix (example: +66).</p>
            </div>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">
            Choose your country code, then enter your number (no need to type the + prefix).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="privacyAccepted"
            required
            disabled={isDisabled || isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300"
          />
          <span>I agree to the processing of my data according to the privacy policy.</span>
        </label>

        <label className="flex items-start gap-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="marketingConsent"
            disabled={isDisabled || isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300"
          />
          <span>I agree to receive future event communications from Woxpat.</span>
        </label>

        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={isDisabled || isSubmitting}
          className="w-full rounded-lg bg-[var(--accent-button)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)]"
        >
          {isSubmitting ? labels.submitting : submitLabel}
        </button>
        {submitNote ? <p className="mt-2 text-xs text-zinc-500">{submitNote}</p> : null}
      </form>
    </section>
  );
}
