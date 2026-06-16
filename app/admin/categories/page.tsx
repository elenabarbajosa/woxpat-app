"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { slugifyCategoryName } from "@/lib/category-utils";
import { supabase } from "@/lib/supabase";

type EventCategoryRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string | null;
};

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<EventCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    const { data, error } = await supabase
      .from("event_categories")
      .select("id,name,slug,is_active,created_at")
      .order("name");

    if (error) {
      setListError(error.message || "No se pudieron cargar las categorías.");
      setRows([]);
      setIsLoading(false);
      return;
    }

    const list = (data ?? []) as EventCategoryRow[];
    list.sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    setRows(list);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCategories();
    });
  }, [loadCategories]);

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    const name = newName.trim();
    if (!name) {
      setActionError("Introduce un nombre de categoría.");
      return;
    }

    const slug = slugifyCategoryName(name) || "category";
    setIsAdding(true);

    const { error } = await supabase.from("event_categories").insert({
      name,
      slug,
      is_active: true,
    });

    if (error) {
      setActionError(error.message || "No se pudo añadir la categoría.");
      setIsAdding(false);
      return;
    }

    setNewName("");
    setIsAdding(false);
    await loadCategories();
  }

  async function setCategoryActive(id: string, isActive: boolean) {
    setActionError(null);
    setBusyId(id);
    const { error } = await supabase.from("event_categories").update({ is_active: isActive }).eq("id", id);
    setBusyId(null);
    if (error) {
      setActionError(error.message || "No se pudo actualizar la categoría.");
      return;
    }
    await loadCategories();
  }

  async function handleDeleteCategory(row: EventCategoryRow) {
    setActionError(null);
    const confirmed = window.confirm(
      `¿Eliminar la categoría "${row.name}"? Solo es posible si ningún evento usa este nombre.`,
    );
    if (!confirmed) return;

    setBusyId(row.id);
    const { count, error: countError } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("category", row.name);

    if (countError) {
      setActionError(countError.message || "No se pudieron comprobar los eventos.");
      setBusyId(null);
      return;
    }

    if ((count ?? 0) > 0) {
      setActionError(
        `No se puede eliminar: ${count} evento(s) usan la categoría "${row.name}". Desactívala en su lugar.`,
      );
      setBusyId(null);
      return;
    }

    const { error } = await supabase.from("event_categories").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      setActionError(error.message || "No se pudo eliminar la categoría.");
      return;
    }
    await loadCategories();
  }

  return (
    <AdminShell
      title="Categorías de eventos"
      subtitle="Gestiona las categorías para eventos nuevos y existentes."
      actions={
        <Link
          href="/admin/events/new"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Crear evento
        </Link>
      }
    >
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Añadir categoría</h2>
        <p className="mt-1 text-sm text-zinc-600">Los nombres deben ser únicos.</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleAddCategory}>
          <div className="min-w-0 flex-1">
            <label htmlFor="newCategoryName" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              id="newCategoryName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isAdding}
              className="box-border w-full min-w-0 max-w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] focus:ring-2"
              placeholder="p. ej. Mesa redonda"
            />
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent-button)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:opacity-60"
          >
            {isAdding ? "Añadiendo…" : "Añadir categoría"}
          </button>
        </form>
        {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-zinc-900">Todas las categorías</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Las categorías desactivadas no aparecen al crear eventos. Los eventos existentes conservan su categoría.
          </p>
        </div>

        {isLoading ? (
          <p className="px-4 py-6 text-sm text-zinc-500 sm:px-5">Cargando categorías…</p>
        ) : listError ? (
          <p className="px-4 py-6 text-sm text-rose-600 sm:px-5">{listError}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500 sm:px-5">
            Aún no hay categorías. Añade una arriba.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-zinc-900">{row.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      row.is_active
                        ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
                        : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80"
                    }`}
                  >
                    {row.is_active ? "Activa" : "Inactiva"}
                  </span>
                  {row.is_active ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setCategoryActive(row.id, false)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {busyId === row.id ? "…" : "Desactivar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setCategoryActive(row.id, true)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {busyId === row.id ? "…" : "Activar"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => handleDeleteCategory(row)}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
