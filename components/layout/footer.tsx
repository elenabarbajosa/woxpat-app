import { Container } from "./container";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50">
      <Container className="py-8 text-sm text-zinc-600">
        <p>
          <a
            href="https://www.woxpat.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 transition hover:underline"
          >
            www.woxpat.com
          </a>
        </p>
      </Container>
    </footer>
  );
}
