"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import {
  AdminEventForm,
  type AdminEventSubmitPayload,
  type EventCategoryOption,
} from "@/components/dashboard/create-event-form";
import { labels } from "@/lib/labels";
import { supabase } from "@/lib/supabase";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCreateEventPage() {
  const [categoryOptions, setCategoryOptions] = useState<EventCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCategories() {
      setCategoriesLoading(true);
      setCategoriesError(null);
      const { data, error } = await supabase
        .from("event_categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("name");

      if (!isMounted) return;

      if (error) {
        setCategoriesError(error.message || labels.couldNotLoadCategories);
        setCategoryOptions([]);
      } else {
        setCategoryOptions((data ?? []) as EventCategoryOption[]);
      }
      setCategoriesLoading(false);
    }

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateEvent(payload: AdminEventSubmitPayload) {
    const baseSlug = generateSlug(payload.title) || `event-${Date.now()}`;
    let slug = baseSlug;

    const { data: existingSlugRows, error: slugCheckError } = await supabase
      .from("events")
      .select("id")
      .eq("slug", baseSlug)
      .limit(1);

    if (slugCheckError) {
      throw new Error(slugCheckError.message || "No se pudo validar el slug del evento.");
    }

    if ((existingSlugRows?.length ?? 0) > 0) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const { error } = await supabase.from("events").insert({
      title: payload.title,
      slug,
      short_description: payload.description,
      long_description: payload.description,
      category: payload.category,
      event_date: payload.date,
      event_time: payload.time,
      location: payload.location,
      capacity: payload.capacity,
      is_paid: payload.isPaid,
      price: payload.isPaid ? payload.price : null,
      waitlist_enabled: payload.waitlistEnabled,
      is_published: payload.published,
    });

    if (error) {
      throw new Error(error.message || "No se pudo crear el evento.");
    }
  }

  return (
    <AdminShell
      title={labels.createEvent}
      subtitle="Configura un nuevo evento con los detalles, precio y ajustes de publicación."
    >
      <AdminEventForm
        onSubmit={handleCreateEvent}
        categoryOptions={categoryOptions}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
      />
    </AdminShell>
  );
}
