"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { todayStr, formatDate, formatTime, CODE_DURATION_MS } from "@/lib/utils";
import Spinner from "@/components/Spinner";
import { useState, useEffect } from "react";

export default function HomePage() {
  const { students, codes, subject, loading } = useApp();
  const [time, setTime] = useState(formatTime());

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <Spinner />;

  const today = todayStr();
  const activeCode = codes[subject];
  const codeActive = activeCode && new Date(activeCode.expiresAt) > new Date();

  const cards = [
    { href: "/registro", title: "Registrarse", desc: "Registrate como alumno con tu DNI" },
    { href: "/asistencia", title: "Marcar Asistencia", desc: "Ingresa tu DNI y el codigo de clase" },
    { href: "/ranking", title: "Ver Ranking", desc: "Consulta tu posicion y rendimiento" },
  ];

  return (
    <div className="animate-fade-in">
      {/* Date and info */}
      <div className="text-center mb-8">
        <p className="text-[var(--color-muted)] text-sm mb-1">{formatDate(today)}</p>
        <p className="font-mono text-3xl font-medium">{time}</p>
        <p className="text-[var(--color-muted)] text-sm mt-2">
          {students.length} alumno{students.length !== 1 ? "s" : ""} registrado{students.length !== 1 ? "s" : ""}
        </p>
        {codeActive && (
          <span className="inline-block mt-2 px-3 py-1 bg-[var(--color-success)] text-white text-xs font-medium rounded-full">
            Codigo activo
          </span>
        )}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent)] transition-colors no-underline text-inherit"
          >
            <h3 className="font-serif text-lg mb-1">{card.title}</h3>
            <p className="text-sm text-[var(--color-muted)]">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
