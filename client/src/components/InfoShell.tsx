import { ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";

export default function InfoShell({
  eyebrow,
  title,
  intro,
  pageTitle,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  pageTitle: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${pageTitle} — Global PV Fire Watch`;
    window.scrollTo(0, 0);
    return () => {
      document.title = "Global PV Fire Watch — Prevention-focused PV fire incident intelligence";
    };
  }, [pageTitle]);

  return (
    <main className="info-page">
      <nav className="info-nav" aria-label="Project navigation">
        <Link className="info-brand" href="/"><ShieldCheck size={18} /> Global PV Fire Watch</Link>
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
