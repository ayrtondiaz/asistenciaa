"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { todayStr, normalizeDate, calculateRanking } from "@/lib/utils";
import Spinner from "@/components/Spinner";

export default function RuletaPage() {
  const { students, attendance, grades, subject, loading } = useApp();
  const [algorithm, setAlgorithm] = useState("uniform");
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState(null);
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, []);

  if (loading) return <Spinner />;

  const today = todayStr();
  const subAtt = attendance[subject] || {};
  const presentDnis = (subAtt[today] || "").split(",").filter(Boolean);
  const presentStudents = students.filter((s) => presentDnis.includes(s.dni));

  // Modo prueba: si no hay alumnos presentes hoy, usar la ultima clase registrada
  const isPreview = presentStudents.length === 0;

  let sourceStudents = presentStudents;
  let previewDate = null;
  if (isPreview) {
    const dates = Object.keys(subAtt)
      .map((d) => ({ raw: d, norm: normalizeDate(d) || "" }))
      .filter((d) => d.norm && d.norm !== today)
      .sort((a, b) => b.norm.localeCompare(a.norm));
    if (dates.length > 0) {
      previewDate = dates[0].raw;
      const lastDnis = (subAtt[previewDate] || "").split(",").filter(Boolean);
      sourceStudents = students.filter((s) => lastDnis.includes(s.dni));
    }
  }

  const ranking = calculateRanking(students, attendance, grades, subject);
  const rankIndex = new Map(ranking.map((r, i) => [r.dni, i]));

  // Excluir los ya sacados en esta sesion
  const excluded = new Set(history.map((h) => h.dni));
  const pool = sourceStudents.filter((s) => !excluded.has(s.dni));

  function weightFor(dni) {
    if (algorithm === "uniform") return 1;
    const idx = rankIndex.get(dni);
    if (idx == null) return 1;
    return ranking.length - idx;
  }

  function pickWeighted(list) {
    const weights = list.map((s) => weightFor(s.dni));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return list[Math.floor(Math.random() * list.length)];
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function spin() {
    if (spinning || pool.length === 0) return;
    setWinner(null);
    setSpinning(true);

    const chosen = pickWeighted(pool);
    const duration = 2500;
    const start = Date.now();

    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const random = pool[Math.floor(Math.random() * pool.length)];
      setDisplayName(random.name);

      if (progress >= 1) {
        setDisplayName(chosen.name);
        setWinner(chosen);
        setHistory((h) => [...h, chosen]);
        setSpinning(false);
        return;
      }
      const delay = 50 + Math.pow(progress, 3) * 250;
      intervalRef.current = setTimeout(tick, delay);
    }
    tick();
  }

  function reset() {
    setHistory([]);
    setWinner(null);
    setDisplayName(null);
  }

  const totalWeight = pool.reduce((a, s) => a + weightFor(s.dni), 0);
  const hasSource = sourceStudents.length > 0;

  // Paletas segun modo
  const tone = {
    accentBg: isPreview ? "bg-[var(--color-muted)]" : "bg-[var(--color-accent)]",
    accentText: isPreview ? "text-[var(--color-muted)]" : "text-[var(--color-accent)]",
    container: isPreview ? "opacity-70 grayscale" : "",
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-serif text-2xl mb-1">Ruleta</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        Elegir un alumno entre los presentes hoy
      </p>

      {/* Banner modo prueba */}
      {isPreview && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[var(--color-border)]/40 border border-[var(--color-border)] text-xs text-[var(--color-muted)]">
          {hasSource ? (
            <>
              <span className="font-medium">Modo prueba.</span> Aún no hay alumnos presentes hoy —
              mostrando alumnos de la última clase. Cuando registren asistencia, la ruleta se activa.
            </>
          ) : (
            <>
              <span className="font-medium">Modo prueba.</span> Aún no hay asistencias registradas
              en esta materia.
            </>
          )}
        </div>
      )}

      {!hasSource ? (
        <div className="text-center py-12 text-[var(--color-muted)]">
          <p>No hay datos de asistencia para probar la ruleta.</p>
        </div>
      ) : (
        <div className={`transition-all ${tone.container}`}>
          {/* Algoritmo */}
          <div className="mb-4">
            <p className="text-xs text-[var(--color-muted)] mb-2">Algoritmo</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setAlgorithm("uniform")}
                disabled={spinning}
                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                  algorithm === "uniform"
                    ? `${tone.accentBg} text-white`
                    : "bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                Uniforme (igual probabilidad)
              </button>
              <button
                onClick={() => setAlgorithm("ranking")}
                disabled={spinning}
                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                  algorithm === "ranking"
                    ? `${tone.accentBg} text-white`
                    : "bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                Por ranking (favorece a los de abajo)
              </button>
            </div>
          </div>

          {/* Display */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-8 text-center mb-4">
            <p className="text-xs text-[var(--color-muted)] mb-2">
              {pool.length} disponible{pool.length !== 1 ? "s" : ""} de {sourceStudents.length}{" "}
              {isPreview ? "alumno" : "presente"}{sourceStudents.length !== 1 ? "s" : ""}
            </p>
            <div className="min-h-[4rem] flex items-center justify-center">
              <p
                className={`font-serif text-3xl font-bold transition-all ${
                  spinning
                    ? "text-[var(--color-muted)] scale-95"
                    : winner
                    ? `${tone.accentText} scale-110`
                    : "text-[var(--color-text)]"
                }`}
              >
                {displayName || "—"}
              </p>
            </div>
            {winner && !spinning && (
              <p className="text-xs text-[var(--color-muted)] font-mono mt-2">
                DNI {winner.dni}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={spin}
              disabled={spinning || pool.length === 0}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer ${tone.accentBg}`}
            >
              {spinning ? "Girando..." : pool.length === 0 ? "Todos ya fueron sacados" : isPreview ? "Girar (prueba)" : "Girar"}
            </button>
            {history.length > 0 && (
              <button
                onClick={reset}
                disabled={spinning}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Reiniciar
              </button>
            )}
          </div>

          {/* Historial */}
          {history.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Ya sacados ({history.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={`${h.dni}-${i}`}
                    className="text-xs px-2 py-1 rounded-md bg-[var(--color-border)]/40 font-medium"
                  >
                    {i + 1}. {h.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Probabilidades */}
          {pool.length > 0 && (
            <details className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
              <summary className="px-3 py-2 text-sm font-medium cursor-pointer">
                Ver probabilidades
              </summary>
              <div className="border-t border-[var(--color-border)] p-3 space-y-1 max-h-80 overflow-y-auto">
                {pool
                  .map((s) => ({ s, w: weightFor(s.dni) }))
                  .sort((a, b) => b.w - a.w)
                  .map(({ s, w }) => {
                    const pct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
                    const rank = rankIndex.get(s.dni);
                    return (
                      <div
                        key={s.dni}
                        className="flex items-center justify-between text-xs px-2 py-1 rounded"
                      >
                        <span>
                          {s.name}
                          {rank != null && (
                            <span className="ml-2 font-mono text-[var(--color-muted)]">
                              #{rank + 1}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-medium">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
