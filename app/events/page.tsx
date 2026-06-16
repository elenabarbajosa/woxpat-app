import { Container } from "@/components/layout/container";
import { PublicShell } from "@/components/layout/public-shell";
import { SectionHeader } from "@/components/shared/section-header";

export default function EventsPage() {
  return (
    <PublicShell>
      <div className="py-12 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="No disponible"
            title="Esta página no está disponible"
            description="Los eventos de Woxpat son privados. Los invitados solo pueden registrarse mediante un enlace directo al evento."
          />
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              Si has recibido una invitación, usa el enlace de registro que te enviaron (WhatsApp o
              email) para abrir la página del evento directamente.
            </p>
          </div>
        </Container>
      </div>
    </PublicShell>
  );
}
