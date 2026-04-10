"use client";

import { useApp } from "@/context/AppContext";
import { formatDate } from "@/lib/utils";

export default function AttendanceTab() {
  const { students, attendance, subject } = useApp();

  const subAtt = attendance[subject] || {};
  const dates = Object.keys(subAtt)
    .sort()
    .reverse()
    .slice(0, 20);

  if (dates.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay registros de asistencia</p>;
  }

  function getStudentName(dni) {
    return students.find((s) => s.dni === dni)?.name || dni;
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Ultimas 20 clases</h3>
      <div className="space-y-3">
        {dates.map((date) => {
          const dnis = (subAtt[date] || "").split(",").filter(Boolean);
          return (
            <div key={date} className="p-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{formatDate(date)}</span>
                <span className="text-xs text-[var(--color-muted)] font-mono">{dnis.length} presente{dnis.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dnis.map((dni) => (
                  <span
                    key={dni}
                    className="px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs rounded-full"
                  >
                    {getStudentName(dni)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
