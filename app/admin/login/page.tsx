"use client";

import { FormEvent } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/container";

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    document.cookie = "woxpat_admin_session=; path=/; max-age=0; samesite=lax";
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.cookie = "woxpat_admin_session=active; path=/; max-age=86400; samesite=lax";
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-16">
      <Container className="max-w-lg">
        <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Admin login</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Frontend-only mock access for the Woxpat admin area.
          </p>

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
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                placeholder="admin@woxpat.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium transition"
            >
              Login
            </button>
          </form>
        </section>
      </Container>
    </div>
  );
}
