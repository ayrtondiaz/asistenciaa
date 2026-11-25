"use client";

import { useState } from "react";

const PHRASES = [
  "Cada linea de codigo que escribiste te trajo hasta aca. Segui asi.",
  "El esfuerzo de hoy es el programador que vas a ser manana.",
  "No se trata de no equivocarse, sino de no dejar de intentarlo.",
  "Los grandes proyectos empiezan con un primer commit. Vos ya diste muchos.",
  "La constancia le gana al talento cuando el talento no es constante.",
  "Aprender a programar es aprender a resolver problemas. Y vos sabes hacerlo.",
  "Todo experto alguna vez fue principiante. Estas en el camino correcto.",
  "Lo que hoy te cuesta, manana lo vas a explicar vos.",
  "Un bug no te define; como lo resolves, si.",
  "Confia en tu proceso: cada clase sumo, aunque no siempre se note.",
];

const STATUS_STYLES = {
  promocion: { label: "Promocionado", color: "var(--color-success)" },
  regular: { label: "Regular", color: "#1d4ed8" },
  pendiente: { label: "Pendiente", color: "var(--color-warning)" },
  libre: { label: "Libre", color: "var(--color-error)" },
};

function statusKey(status) {
  const s = status.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (s.startsWith("promocion")) return "promocion";
  if (s.startsWith("regular")) return "regular";
  if (s.startsWith("pendiente")) return "pendiente";
  return "libre";
}

export default function RegularidadesPage() {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [phrase, setPhrase] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!/^\d{7,8}$/.test(dni)) {
      setError("El DNI debe tener 7 u 8 digitos");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/regularidad?dni=${dni}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error desconocido");
      if (!json.data) {
        setError("No encontramos ese DNI en la planilla de regularidad");
        return;
      }
      setResult(json.data);
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const style = result ? STATUS_STYLES[statusKey(result.status)] : null;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <h2 className="font-serif text-2xl mb-1">Regularidades</h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        Ingresa tu DNI para ver tu situacion curricular
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">DNI</label>
          <input
            type="text"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="42123456"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Consultando..." : "Ver mi situacion"}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
      )}

      {result && style && (
        <div className="mt-6 p-5 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] animate-fade-in">
          {result.name && <p className="text-sm text-[var(--color-muted)] mb-3">{result.name}</p>}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Situacion</p>
              <p className="font-serif text-3xl" style={{ color: style.color }}>
                {style.label}
              </p>
            </div>
            {result.grade && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Nota</p>
                <p className="font-mono text-3xl font-medium">{result.grade}</p>
              </div>
            )}
          </div>
          <p className="mt-5 pt-4 border-t border-[var(--color-border)] text-sm italic text-[var(--color-muted)]">
            {phrase}
          </p>
        </div>
      )}
    </div>
  );
}
