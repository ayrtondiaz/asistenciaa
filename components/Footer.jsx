"use client";

import { useApp } from "@/context/AppContext";

const SUBJECT_NAMES = {
  ppii: "Practicas Profesionalizantes II",
  programacion: "Programacion",
};

export default function Footer() {
  const { subject } = useApp();

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-muted)]">
      <p className="font-medium">{SUBJECT_NAMES[subject]}</p>
      <p>Programador Junior 2026 — Ing. Diaz Ayrton</p>
    </footer>
  );
}
