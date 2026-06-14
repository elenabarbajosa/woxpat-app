"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/container";
import { supabase } from "@/lib/supabase";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loggedOut = searchParams.get("loggedOut") === "1";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage("Email o contraseña incorrectos");
        return;
      }

      const accessResponse = await fetch("/api/admin/check-access");
      if (!accessResponse.ok) {
        await supabase.auth.signOut();
        setErrorMessage("Email o contraseña incorrectos");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Email o contraseña incorrectos");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-16">
      <Container className="max-w-lg">
        <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Acceso al panel</h1>
          <p className="mt-2 text-sm text-zinc-600">Introduce tu email y contraseña para entrar.</p>

          {loggedOut ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Sesión cerrada correctamente
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </Container>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 py-16">
          <Container className="max-w-lg">
            <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-sm text-zinc-600">Cargando...</p>
            </section>
          </Container>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
