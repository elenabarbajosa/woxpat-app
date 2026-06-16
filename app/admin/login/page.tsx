"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/container";
import { buildPasswordResetRedirectUrl } from "@/lib/app-url";
import { supabase } from "@/lib/supabase";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loggedOut = searchParams.get("loggedOut") === "1";
  const passwordUpdated = searchParams.get("passwordUpdated") === "1";
  const unauthorized = searchParams.get("error") === "unauthorized";
  const resetLinkInvalid = searchParams.get("error") === "reset_link_invalid";

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(data.error ?? "Correo electrónico o contraseña incorrectos");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Correo electrónico o contraseña incorrectos");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingReset(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("resetEmail") ?? "").trim();

    if (!email) {
      setErrorMessage("Introduce tu correo electrónico.");
      setIsSendingReset(false);
      return;
    }

    try {
      const redirectTo = buildPasswordResetRedirectUrl(window.location.origin);
      console.info("[reset-password] redirectTo:", redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        console.error("[auth] Password reset request failed:", error.message);
        setErrorMessage("No se pudo enviar el email de recuperación. Inténtalo de nuevo.");
        return;
      }

      setSuccessMessage(
        "Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.",
      );
      setShowForgotPassword(false);
    } catch {
      setErrorMessage("No se pudo enviar el email de recuperación. Inténtalo de nuevo.");
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-16">
      <Container className="max-w-lg">
        <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Acceso administrador</h1>
          <p className="mt-2 text-sm text-zinc-600">Accede al panel de administración de Woxpat.</p>

          {loggedOut ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Sesión cerrada correctamente
            </p>
          ) : null}

          {passwordUpdated ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Contraseña actualizada correctamente
            </p>
          ) : null}

          {unauthorized ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Correo electrónico o contraseña incorrectos
            </p>
          ) : null}

          {resetLinkInvalid ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.
            </p>
          ) : null}

          {successMessage ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {showForgotPassword ? (
            <form className="mt-6 space-y-4" onSubmit={handleForgotPasswordSubmit}>
              <div>
                <label
                  htmlFor="resetEmail"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Correo electrónico
                </label>
                <input
                  id="resetEmail"
                  name="resetEmail"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                  placeholder="tu@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingReset}
                className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingReset ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-sm text-zinc-600 transition hover:text-zinc-900"
              >
                Volver al acceso
              </button>
            </form>
          ) : (
            <>
              <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Correo electrónico
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
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
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

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="mt-4 text-sm text-zinc-600 transition hover:text-zinc-900"
              >
                ¿Has olvidado tu contraseña?
              </button>
            </>
          )}
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
