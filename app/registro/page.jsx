"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Spinner from "@/components/Spinner";

export default function RegistroPage() {
  const { students, addStudent, loading, showToast } = useApp();
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Spinner />;

  async function handleSubmit(e) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedDni = dni.trim();

    if (!trimmedName || !trimmedDni) {
      showToast("Completa nombre y DNI", "warning");
      return;
    }

    if (!/^\d{7,8}$/.test(trimmedDni)) {
      showToast("El DNI debe tener 7 u 8 digitos", "error");
      return;
    }

    if (students.some((s) => s.dni === trimmedDni)) {
      showToast("Este DNI ya esta registrado", "warning");
      return;
    }

    setSubmitting(true);
    const newStudent = {
      id: Date.now().toString(),
      name: trimmedName,
      dni: trimmedDni,
      email: email.trim(),
      createdAt: new Date().toISOString(),
    };

    await addStudent(newStudent);
    showToast("Registro exitoso!", "success");
    setName("");
    setDni("");
    setEmail("");
    setSubmitting(false);
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <h2 className="font-serif text-2xl mb-1">Registro</h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        {students.length} alumno{students.length !== 1 ? "s" : ""} registrado{students.length !== 1 ? "s" : ""}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Perez"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
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
          <label className="block text-sm font-medium mb-1">Email <span className="text-[var(--color-muted)]">(opcional)</span></label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@email.com"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Registrando..." : "Registrarse"}
        </button>
      </form>
    </div>
  );
}
