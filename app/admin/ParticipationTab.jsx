"use client";

import { useApp } from "@/context/AppContext";

export default function ParticipationTab() {
  const { students, grades, subject, showToast, setGrade } = useApp();

  const subGrades = grades[subject] || {};

  async function updateParticipation(dni, delta) {
    const current = Number(subGrades[dni]?.Participacion || 0);
    const next = Math.max(0, current + delta);
    if (next === current) return;

    await setGrade(subject, dni, "Participacion", next);
    showToast(`Participacion: ${next}`, "success");
  }

  if (students.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay alumnos registrados</p>;
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Participacion</h3>
      <div className="space-y-2">
        {students.map((s) => {
          const val = Number(subGrades[s.dni]?.Participacion || 0);
          return (
            <div
              key={s.dni}
              className="flex items-center justify-between px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg"
            >
              <div>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{s.dni}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateParticipation(s.dni, -1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-error)] hover:text-white transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono text-sm font-bold w-6 text-center">{val}</span>
                <button
                  onClick={() => updateParticipation(s.dni, 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-success)] hover:text-white transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
