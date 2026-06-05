import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PublicShell } from "@/components/layout/public-shell";

export default function PaymentSuccessPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <PublicShell>
      <div className="py-12 sm:py-16">
        <Container>
          <Link
            href={`/events/${params.slug}`}
            className="text-sm text-zinc-600 underline-offset-4 hover:underline"
          >
            Volver al evento
          </Link>

          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
              Pago completado
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
              Hemos recibido tu pago
            </h1>
            <p className="mt-3 text-sm text-zinc-600">
              Estamos confirmando tu registro. Recibirás un email de confirmación en breve con los
              detalles del evento.
            </p>
          </section>
        </Container>
      </div>
    </PublicShell>
  );
}

