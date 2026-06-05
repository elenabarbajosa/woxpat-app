"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { labels } from "@/lib/labels";
import type { EventCategory } from "@/lib/types";

export type EventCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export interface AdminEventFormValues {
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  capacity: string;
  isPaid: boolean;
  price: string;
  waitlistEnabled: boolean;
  published: boolean;
}

export interface AdminEventSubmitPayload {
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  capacity: number;
  isPaid: boolean;
  price: number;
  waitlistEnabled: boolean;
  published: boolean;
}

const defaultFormValues: AdminEventFormValues = {
  title: "",
  description: "",
  category: "",
  date: "",
  time: "",
  location: "",
  capacity: "",
  isPaid: false,
  price: "",
  waitlistEnabled: true,
  published: false,
};

const inputClassName =
  "box-border min-h-0 w-full min-w-0 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[color:var(--accent-ring)] transition placeholder:text-zinc-400 focus:ring-2";

interface AdminEventFormProps {
  initialValues?: Partial<AdminEventFormValues>;
  submitLabel?: string;
  onSubmitLogLabel?: string;
  redirectTo?: string;
  onSubmit?: (payload: AdminEventSubmitPayload) => Promise<void>;
  categoryOptions: EventCategoryOption[];
  categoriesLoading?: boolean;
  categoriesError?: string | null;
}

export function AdminEventForm({
  initialValues,
  submitLabel = labels.createEvent,
  onSubmitLogLabel = "Create event payload",
  redirectTo = "/",
  onSubmit,
  categoryOptions,
  categoriesLoading = false,
  categoriesError = null,
}: AdminEventFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<AdminEventFormValues>({
    ...defaultFormValues,
    ...initialValues,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (categoriesLoading || categoryOptions.length === 0) return;
    setFormState((prev) => {
      if (categoryOptions.some((c) => c.name === prev.category)) return prev;
      const fromInitial =
        initialValues?.category && categoryOptions.some((c) => c.name === initialValues.category)
          ? initialValues.category
          : null;
      const next = fromInitial ?? categoryOptions[0]?.name ?? "";
      return { ...prev, category: next };
    });
  }, [categoriesLoading, categoryOptions, initialValues?.category]);

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  }

  function handleToggleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, checked } = event.target;

    setFormState((currentState) => ({
      ...currentState,
      [name]: checked,
      ...(name === "isPaid" && !checked ? { price: "" } : {}),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const parsedCapacity = Number(formState.capacity);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      setSubmitError("Capacity must be a valid number greater than 0.");
      setIsSubmitting(false);
      return;
    }

    const parsedPrice = Number(formState.price);
    const safePrice =
      formState.isPaid && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;

    if (!categoriesLoading && categoryOptions.length > 0 && !formState.category.trim()) {
      setSubmitError("Please select a category.");
      setIsSubmitting(false);
      return;
    }

    if (!categoriesLoading && categoryOptions.length === 0) {
      setSubmitError("Add at least one active category before creating an event.");
      setIsSubmitting(false);
      return;
    }

    const payload: AdminEventSubmitPayload = {
      ...formState,
      capacity: parsedCapacity,
      price: safePrice,
    };

    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        console.log(onSubmitLogLabel, payload);
      }
      router.push(redirectTo);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{labels.basicInfo}</h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.title}
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={formState.title}
              onChange={handleInputChange}
              className={inputClassName}
              placeholder="Lisbon Breakfast Circle"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              {labels.shortDescription}
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              value={formState.description}
              onChange={handleInputChange}
              className={inputClassName}
              placeholder="A curated meetup for meaningful connections and practical conversations."
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.category}
            </label>
            {categoriesError ? (
              <p className="text-sm text-rose-600">{categoriesError}</p>
            ) : null}
            {!categoriesError && !categoriesLoading && categoryOptions.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No active categories yet.{" "}
                <Link href="/admin/categories" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
                  Manage categories
                </Link>
              </p>
            ) : null}
            <select
              id="category"
              name="category"
              value={formState.category}
              onChange={handleInputChange}
              disabled={isSubmitting || categoriesLoading || categoryOptions.length === 0}
              required={categoryOptions.length > 0}
              className={inputClassName}
            >
              {categoriesLoading ? (
                <option value="">Loading categories...</option>
              ) : (
                categoryOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">{labels.eventDetails}</h2>
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 w-full">
            <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.date}
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={formState.date}
              onChange={handleInputChange}
              className={inputClassName}
            />
          </div>

          <div className="min-w-0 w-full">
            <label htmlFor="time" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.time}
            </label>
            <input
              id="time"
              name="time"
              type="time"
              required
              value={formState.time}
              onChange={handleInputChange}
              className={inputClassName}
            />
          </div>

          <div className="min-w-0 w-full">
            <label htmlFor="location" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.location}
            </label>
            <input
              id="location"
              name="location"
              type="text"
              required
              value={formState.location}
              onChange={handleInputChange}
              className={inputClassName}
              placeholder="Amelia Cafe, Lisbon"
            />
          </div>

          <div className="min-w-0 w-full">
            <label htmlFor="capacity" className="mb-1.5 block text-sm font-medium text-zinc-700">
              {labels.capacity}
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              required
              value={formState.capacity}
              onChange={handleInputChange}
              className={inputClassName}
              placeholder="12"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{labels.pricing}</h2>
        <div className="mt-5 space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-zinc-900">{labels.paidEvent}</span>
              <span className="block text-xs text-zinc-500">
                Actívalo para cobrar un precio por el evento.
              </span>
            </span>
            <input
              type="checkbox"
              name="isPaid"
              checked={formState.isPaid}
              onChange={handleToggleChange}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
          </label>

          {formState.isPaid ? (
            <div>
              <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-zinc-700">
                {labels.price}
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                required={formState.isPaid}
                value={formState.price}
                onChange={handleInputChange}
                className={inputClassName}
                placeholder="25"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{labels.settings}</h2>
        <div className="mt-5 space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-zinc-900">{labels.waitlistEnabled}</span>
              <span className="block text-xs text-zinc-500">
                Permite registros cuando se alcance la capacidad.
              </span>
            </span>
            <input
              type="checkbox"
              name="waitlistEnabled"
              checked={formState.waitlistEnabled}
              onChange={handleToggleChange}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-zinc-900">{labels.published}</span>
              <span className="block text-xs text-zinc-500">
                Mantén activado para que los invitados puedan registrarse con el enlace privado.
              </span>
            </span>
            <input
              type="checkbox"
              name="published"
              checked={formState.published}
              onChange={handleToggleChange}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          {labels.cancel}
        </Link>
        {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent-button)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)]"
        >
          {isSubmitting ? labels.saving : submitLabel}
        </button>
      </div>
    </form>
  );
}
