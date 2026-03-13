"use client";

import { useApp } from "@/context/AppContext";

export default function StudentsTab() {
  const { students, removeStudent, showToast } = useApp();

  async function deleteStudent(dni) {
    await removeStudent(dni);
    showToast("Alumno eliminado", "info");
  }

  if (students.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay alumnos registrados</p>;
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Alumnos ({students.length})</h3>
      <div className="space-y-1">
        {students.map((s) => (
          <div
            key={s.dni}
            className="flex items-center justify-between px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg"
          >
            <div>
              <span className="text-sm font-medium">{s.name}</span>
              <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{s.dni}</span>
              {s.email && <span className="ml-2 text-xs text-[var(--color-muted)]">{s.email}</span>}
            </div>
            <button
              onClick={() => deleteStudent(s.dni)}
              className="text-xs text-[var(--color-error)] hover:underline cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
