"use client";

import { useApp } from "@/context/AppContext";

export default function ParticipationTab() {
  const { students, participation, grades, subject, showToast, incrementParticipation } = useApp();

  const subPart = participation[subject] || {};
  const subGrades = grades[subject] || {};

  // Fallback defensivo: si la hoja `participation` aun no tiene la entrada
  // (por ejemplo antes de que corra la migracion en el Apps Script), leer
  // el valor legacy desde grades.Participacion. Asi el panel no muestra 0
  // mientras el backend termina de migrar.
  function getCount(dni) {
    if (subPart[dni] != null) return Number(subPart[dni] || 0);
    return Number(subGrades[dni]?.["Participacion"] || 0);
  }

  // Total agregado de la materia
  const totalSubject = students.reduce((acc, s) => acc + getCount(s.dni), 0);

  async function updateParticipation(dni, delta) {
    const current = getCount(dni);
    if (delta < 0 && current === 0) return;
    try {
      await incrementParticipation(subject, dni, delta);
      showToast(`Participacion: ${Math.max(0, current + delta)}`, "success");
    } catch {
      showToast("Error al actualizar participacion", "error");
    }
  }

  if (students.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay alumnos registrados</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Participacion</h3>
        <span className="text-xs font-mono text-[var(--color-muted)]">
          Total materia: <span className="text-[var(--color-text)] font-bold">{totalSubject}</span>
        </span>
      </div>
      <div className="space-y-2">
        {students.map((s) => {
          const val = getCount(s.dni);
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
