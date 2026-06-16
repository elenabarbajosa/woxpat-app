"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/container";
import { supabase } from "@/lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoverySession() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      const sessionExists = Boolean(user);
      console.info("[reset-password] session exists:", sessionExists);

      if (error) {
        console.error("[reset-password] session validation failed:", error.message);
      }

      setHasSession(sessionExists);
      setIsReady(true);

      if (!sessionExists) {
        setErrorMessage(
          "El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo desde el login.",
        );
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      const sessionExists = Boolean(session);
      console.info("[reset-password] session exists:", sessionExists, `(event: ${event})`);

      if (sessionExists) {
        setHasSession(true);
        setIsReady(true);
        setErrorMessage(null);
      }
    });

    void verifyRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        console.error("[reset-password] update failed:", error.message);
        setErrorMessage("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
        return;
      }

      await supabase.auth.signOut();
      router.push("/admin/login?passwordUpdated=1");
      router.refresh();
    } catch {
      setErrorMessage("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-zinc-50 py-16">
        <Container className="max-w-lg">
          <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
            <p className="text-sm text-zinc-600">Verificando enlace de recuperación...</p>
          </section>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-16">
      <Container className="max-w-lg">
        <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Nueva contraseña</h1>
          <p className="mt-2 text-sm text-zinc-600">Introduce y confirma tu nueva contraseña.</p>

          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {hasSession ? (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="newPassword"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Nueva contraseña
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="mt-6 text-sm text-zinc-600 transition hover:text-zinc-900"
            >
              Volver al login
            </button>
          )}
        </section>
      </Container>
    </div>
  );
}

export default function AdminResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
