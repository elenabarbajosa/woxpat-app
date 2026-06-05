import { Container } from "@/components/layout/container";
import { PublicShell } from "@/components/layout/public-shell";
import { SectionHeader } from "@/components/shared/section-header";

export default function EventsPage() {
  return (
    <PublicShell>
      <div className="py-12 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="Not available"
            title="This page isn’t available"
            description="Woxpat events are private. Guests can only register using a direct event link."
          />
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              If you were invited, use the registration link sent to you (WhatsApp/email) to open
              the event page directly.
            </p>
          </div>
        </Container>
      </div>
    </PublicShell>
  );
}
