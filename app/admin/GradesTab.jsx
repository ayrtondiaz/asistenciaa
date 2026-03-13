"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { GRADE_FIELDS } from "@/lib/utils";

export default function GradesTab() {
  const { students, grades, subject, showToast, setGrade } = useApp();
  const [selectedDni, setSelectedDni] = useState("");

  const subGrades = grades[subject] || {};
  const studentGrades = selectedDni ? subGrades[selectedDni] || {} : {};

  async function updateGrade(field, value) {
    await setGrade(subject, selectedDni, field, value === "" ? null : value);
    showToast("Nota guardada", "success");
  }

  if (students.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay alumnos registrados</p>;
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Cargar Notas</h3>

      {/* Student selector */}
      <select
        value={selectedDni}
        onChange={(e) => setSelectedDni(e.target.value)}
        className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm mb-4 focus:outline-none focus:border-[var(--color-accent)]"
      >
        <option value="">Seleccionar alumno...</option>
        {students.map((s) => (
          <option key={s.dni} value={s.dni}>{s.name} ({s.dni})</option>
        ))}
      </select>

      {selectedDni && (
        <div className="space-y-6">
          {/* TPs */}
          <div>
            <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
              Trabajos Practicos (0-100)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADE_FIELDS.tps.map((tp) => (
                <div key={tp} className="flex flex-col">
                  <label className="text-xs text-[var(--color-muted)] mb-0.5">{tp}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={studentGrades[tp] ?? ""}
                    onChange={(e) => updateGrade(tp, e.target.value)}
                    className="px-2 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-card)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Exams */}
          <div>
            <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
              Parciales (0-10)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {GRADE_FIELDS.exams.map((ex) => (
                <div key={ex} className="flex flex-col">
                  <label className="text-xs text-[var(--color-muted)] mb-0.5">{ex}</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={studentGrades[ex] ?? ""}
                    onChange={(e) => updateGrade(ex, e.target.value)}
                    className="px-2 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-card)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div>
            <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
              Proyectos (0-100)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {GRADE_FIELDS.projects.map((proj) => (
                <div key={proj} className="flex flex-col">
                  <label className="text-xs text-[var(--color-muted)] mb-0.5">{proj}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={studentGrades[proj] ?? ""}
                    onChange={(e) => updateGrade(proj, e.target.value)}
                    className="px-2 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-card)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
