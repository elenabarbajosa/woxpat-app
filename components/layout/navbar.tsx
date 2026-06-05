import Link from "next/link";
import { Container } from "./container";

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          Woxpat
        </Link>
        <div className="text-sm text-zinc-500">Registros privados</div>
      </Container>
    </header>
  );
}
