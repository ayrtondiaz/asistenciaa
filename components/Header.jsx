"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";

const SUBJECTS = [
  { key: "ppii", label: "PP II" },
  { key: "programacion", label: "Programacion" },
];

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/ruleta", label: "Ruleta" },
  { href: "/registro", label: "Registro" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/ranking", label: "Ranking" },
  { href: "/admin", label: "Admin" },
];

export default function Header() {
  const pathname = usePathname();
  const { subject, setSubject } = useApp();

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto px-4 py-3">
        {/* Subject selector */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-xl tracking-tight">Asistencia <span className="text-[var(--color-muted)] text-sm font-sans font-normal">2026</span></h1>
          <div className="flex gap-1">
            {SUBJECTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSubject(s.key)}
                className={`px-3 py-1 text-sm rounded-full font-medium transition-colors cursor-pointer ${
                  subject === s.key
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors no-underline ${
                  isActive
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
