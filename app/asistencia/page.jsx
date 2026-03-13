"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { todayStr, CODE_DURATION_MS } from "@/lib/utils";
import Spinner from "@/components/Spinner";

export default function AsistenciaPage() {
  const { students, attendance, codes, subject, loading, showToast, addAttendance } = useApp();
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const today = todayStr();
  const activeCode = codes[subject];
  const subAtt = attendance[subject] || {};
  const todayDnis = (subAtt[today] || "").split(",").filter(Boolean);
  const presentCount = todayDnis.length;

  // Timer for code countdown
  useEffect(() => {
    if (!activeCode) { setRemaining(null); return; }
    function tick() {
      const diff = new Date(activeCode.expiresAt) - new Date();
      setRemaining(diff > 0 ? diff : null);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCode]);

  if (loading) return <Spinner />;

  const codeActive = remaining !== null && remaining > 0;
  const mins = remaining ? Math.floor(remaining / 60000) : 0;
  const secs = remaining ? Math.floor((remaining % 60000) / 1000) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedDni = dni.trim();
    const trimmedCode = code.trim();

    if (!trimmedDni || !trimmedCode) {
      showToast("Completa DNI y codigo", "warning");
      return;
    }

    if (!students.some((s) => s.dni === trimmedDni)) {
      showToast("DNI no registrado. Registrate primero.", "error");
      return;
    }

    if (!codeActive) {
      showToast("No hay codigo activo en este momento", "error");
      return;
    }

    if (trimmedCode !== activeCode.code) {
      showToast("Codigo incorrecto", "error");
      return;
    }

    if (todayDnis.includes(trimmedDni)) {
      showToast("Ya registraste asistencia hoy", "warning");
      return;
    }

    setSubmitting(true);
    await addAttendance(subject, today, trimmedDni);
    showToast("Asistencia registrada!", "success");
    setDni("");
    setCode("");
    setSubmitting(false);
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <h2 className="font-serif text-2xl mb-1">Marcar Asistencia</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        {presentCount} presente{presentCount !== 1 ? "s" : ""} hoy
      </p>

      {/* Code timer */}
      {codeActive ? (
        <div className="mb-6 p-4 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-xl text-center">
          <p className="text-xs text-[var(--color-success)] font-medium mb-1">Codigo activo — Tiempo restante</p>
          <p className="font-mono text-2xl text-[var(--color-success)] font-bold">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-[var(--color-border)]/50 rounded-xl text-center">
          <p className="text-sm text-[var(--color-muted)]">No hay codigo activo</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">DNI</label>
          <input
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="42123456"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Codigo</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm font-mono text-center text-xl tracking-[0.5em] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !codeActive}
          className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Registrando..." : "Registrar Asistencia"}
        </button>
      </form>
    </div>
  );
}
