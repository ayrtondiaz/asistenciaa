"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { todayStr, normalizeDate, calculateRanking } from "@/lib/utils";

export default function RuletaTab() {
  const { students, attendance, grades, subject, setGrade, showToast } = useApp();
  const [algorithm, setAlgorithm] = useState("uniform");
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState(null);
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  const [adjusted, setAdjusted] = useState(new Map()); // dni -> "plus" | "minus"
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, []);

  const today = todayStr();
  const subAtt = attendance[subject] || {};
  const presentDnis = (subAtt[today] || "").split(",").filter(Boolean);
  const presentStudents = students.filter((s) => presentDnis.includes(s.dni));

  const isPreview = presentStudents.length === 0;

  let sourceStudents = presentStudents;
  if (isPreview) {
    const dates = Object.keys(subAtt)
      .map((d) => ({ raw: d, norm: normalizeDate(d) || "" }))
      .filter((d) => d.norm && d.norm !== today)
      .sort((a, b) => b.norm.localeCompare(a.norm));
    if (dates.length > 0) {
      const lastDnis = (subAtt[dates[0].raw] || "").split(",").filter(Boolean);
      sourceStudents = students.filter((s) => lastDnis.includes(s.dni));
    }
  }

  const ranking = calculateRanking(students, attendance, grades, subject);
  const rankIndex = new Map(ranking.map((r, i) => [r.dni, i]));

  const excluded = new Set(history.map((h) => h.dni));
  const pool = sourceStudents.filter((s) => !excluded.has(s.dni));

  function weightFor(dni) {
    if (algorithm === "uniform") return 1;
    // ranking esta ordenado de mejor (idx 0) a peor (idx N-1).
    // Los peores deben tener mayor probabilidad => peso = idx + 1.
    const idx = rankIndex.get(dni);
    if (idx == null) return 1;
    return idx + 1;
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
    setAdjusted(new Map());
  }

  async function adjustParticipation(dni, delta) {
    if (isPreview) return;
    if (adjusted.has(dni)) return;
    const subGrades = grades[subject] || {};
    const current = Number(subGrades[dni]?.Participacion || 0);
    const next = Math.max(0, current + delta);
    if (next === current) {
      showToast("No se puede bajar de 0", "error");
      return;
    }
    try {
      await setGrade(subject, dni, "Participacion", next);
      setAdjusted((prev) => {
        const m = new Map(prev);
        m.set(dni, delta > 0 ? "plus" : "minus");
        return m;
      });
      showToast(
        `${delta > 0 ? "+" : ""}${delta} participación (total: ${next})`,
        delta > 0 ? "success" : "info"
      );
    } catch {
      showToast("Error al actualizar participación", "error");
    }
  }

  const totalWeight = pool.reduce((a, s) => a + weightFor(s.dni), 0);
  const hasSource = sourceStudents.length > 0;

  const tone = {
    accentBg: isPreview ? "bg-[var(--color-muted)]" : "bg-[var(--color-accent)]",
    accentText: isPreview ? "text-[var(--color-muted)]" : "text-[var(--color-accent)]",
    container: isPreview ? "opacity-70 grayscale" : "",
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Ruleta</h3>

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
              <>
                <p className="text-xs text-[var(--color-muted)] font-mono mt-2">
                  DNI {winner.dni}
                </p>
                {!isPreview && (() => {
                  const status = adjusted.get(winner.dni);
                  const done = !!status;
                  return (
                    <div className="mt-3 flex gap-2 justify-center">
                      <button
                        onClick={() => adjustParticipation(winner.dni, -1)}
                        disabled={done}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/40 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {status === "minus" ? "✓ -1 aplicado" : "-1 participación"}
                      </button>
                      <button
                        onClick={() => adjustParticipation(winner.dni, 1)}
                        disabled={done}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-success)]/20 text-[var(--color-success)] hover:bg-[var(--color-success)]/40 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {status === "plus" ? "✓ +1 aplicado" : "+1 participación"}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

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

          {history.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Ya sacados ({history.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => {
                  const status = adjusted.get(h.dni);
                  let cls = "bg-[var(--color-border)]/40";
                  let suffix = "";
                  if (status === "plus") {
                    cls = "bg-[var(--color-success)]/20 text-[var(--color-success)]";
                    suffix = " +1";
                  } else if (status === "minus") {
                    cls = "bg-[var(--color-error)]/20 text-[var(--color-error)]";
                    suffix = " -1";
                  }
                  return (
                    <span
                      key={`${h.dni}-${i}`}
                      className={`text-xs px-2 py-1 rounded-md font-medium ${cls}`}
                    >
                      {i + 1}. {h.name}
                      {suffix}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

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
