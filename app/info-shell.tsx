import { Flame } from "lucide-react";
import Link from "next/link";

export default function InfoShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="info-page">
      <nav className="info-nav" aria-label="Project navigation">
        <Link className="info-brand" href="/"><Flame size={18} /> Global PV Fire Watch</Link>
        <Link href="/">Return to dashboard</Link>
      </nav>
      <header>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="info-content">{children}</div>
    </main>
  );
}
