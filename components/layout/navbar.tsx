import { Container } from "./container";

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center">
        <span className="text-lg font-semibold tracking-tight text-zinc-900">Woxpat</span>
      </Container>
    </header>
  );
}
