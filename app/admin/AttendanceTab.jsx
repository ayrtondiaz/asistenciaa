"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate, normalizeDate, calculateRanking } from "@/lib/utils";

export default function AttendanceTab() {
  const { students, attendance, grades, subject, addAttendance, removeAttendance, showToast } = useApp();
  const [expandedDate, setExpandedDate] = useState(null);
  const [addQuery, setAddQuery] = useState("");
  const [busyDni, setBusyDni] = useState(null);

  const subAtt = attendance[subject] || {};
  const dates = Object.keys(subAtt)
    .sort((a, b) => (normalizeDate(a) || "").localeCompare(normalizeDate(b) || ""))
    .reverse()
    .slice(0, 20);

  const ranking = calculateRanking(students, attendance, grades, subject);

  if (dates.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No hay registros de asistencia</p>;
  }

  function getStudentName(dni) {
    return students.find((s) => s.dni === dni)?.name || dni;
  }

  function getRankPosition(dni) {
    const idx = ranking.findIndex((r) => r.dni === dni);
    return idx >= 0 ? idx + 1 : 999;
  }

  function toggleDate(date) {
    setExpandedDate((prev) => (prev === date ? null : date));
    setAddQuery("");
  }

  async function handleRemove(date, dni) {
    if (busyDni) return;
    if (!confirm(`¿Quitar a ${getStudentName(dni)} de esta fecha?`)) return;
    setBusyDni(dni);
    try {
      await removeAttendance(subject, date, dni);
      showToast("Alumno eliminado", "success");
    } catch {
      showToast("Error al eliminar", "error");
    }
    setBusyDni(null);
  }

  async function handleAdd(date, dni) {
    if (busyDni) return;
    setBusyDni(dni);
    try {
      await addAttendance(subject, date, dni);
      showToast("Alumno agregado", "success");
      setAddQuery("");
    } catch {
      showToast("Error al agregar", "error");
    }
    setBusyDni(null);
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Ultimas 20 clases</h3>
      <div className="space-y-3">
        {dates.map((date) => {
          const dnis = (subAtt[date] || "").split(",").filter(Boolean);
          const isExpanded = expandedDate === date;

          // Sort DNIs by ranking position
          const sortedDnis = [...dnis].sort(
            (a, b) => getRankPosition(a) - getRankPosition(b)
          );
          const dangerStart = Math.max(0, ranking.length - 10);
          const warningStart = Math.max(0, ranking.length - 13);

          // Absent students filtered by search query
          const q = addQuery.trim().toLowerCase();
          const absent = ranking.filter((r) => !dnis.includes(r.dni));
          const addMatches = q
            ? absent.filter(
                (r) =>
                  r.name.toLowerCase().includes(q) || String(r.dni).includes(q)
              )
            : [];

          return (
            <div
              key={date}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden"
            >
              {/* Card header - clickable */}
              <button
                onClick={() => toggleDate(date)}
                className="w-full p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--color-border)]/30 transition-colors"
              >
                <span className="text-sm font-medium">{formatDate(date)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-muted)] font-mono">
                    {dnis.length} presente{dnis.length !== 1 ? "s" : ""} / {students.length}
                  </span>
                  <span className={`text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Expanded content - student list sorted by ranking */}
              {isExpanded && (
                <div className="border-t border-[var(--color-border)] p-3">
                  {/* Add student search */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Agregar alumno (nombre o DNI)"
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    {q && addMatches.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-md">
                        {addMatches.slice(0, 8).map((r) => (
                          <button
                            key={r.dni}
                            onClick={() => handleAdd(date, r.dni)}
                            disabled={busyDni === r.dni}
                            className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--color-border)]/30 flex justify-between items-center disabled:opacity-50"
                          >
                            <span>{r.name}</span>
                            <span className="text-xs font-mono text-[var(--color-muted)]">{r.dni}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {q && addMatches.length === 0 && (
                      <p className="text-xs text-[var(--color-muted)] mt-1">Sin coincidencias entre ausentes</p>
                    )}
                  </div>

                  <p className="text-xs text-[var(--color-muted)] mb-2">
                    Alumnos presentes (ordenados por ranking)
                  </p>
                  <div className="space-y-1">
                    {sortedDnis.map((dni) => {
                      const rankPos = getRankPosition(dni);
                      const isDanger = ranking.length > 10 && rankPos > dangerStart;
                      const isWarning = !isDanger && ranking.length > 13 && rankPos > warningStart;
                      let colorClass = "bg-[var(--color-success)]/10 text-[var(--color-success)]";
                      if (isDanger) colorClass = "bg-red-500/10 text-red-500";
                      else if (isWarning) colorClass = "bg-yellow-500/10 text-yellow-500";
                      return (
                        <div
                          key={dni}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm ${colorClass}`}
                        >
                          <span className="font-medium">{getStudentName(dni)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono opacity-70">#{rankPos}</span>
                            <button
                              onClick={() => handleRemove(date, dni)}
                              disabled={busyDni === dni}
                              title="Quitar asistencia"
                              className="text-xs px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-500 disabled:opacity-50"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Absent students */}
                  {students.length > dnis.length && (
                    <>
                      <p className="text-xs text-[var(--color-muted)] mt-3 mb-2">
                        Ausentes ({students.length - dnis.length})
                      </p>
                      <div className="space-y-1">
                        {ranking
                          .filter((r) => !dnis.includes(r.dni))
                          .map((r) => {
                            const rankPos = getRankPosition(r.dni);
                            const isDanger = ranking.length > 10 && rankPos > dangerStart;
                            const isWarning = !isDanger && ranking.length > 13 && rankPos > warningStart;
                            let absentClass = "bg-[var(--color-border)]/30 text-[var(--color-muted)]";
                            if (isDanger) absentClass = "bg-red-500/5 text-red-400";
                            else if (isWarning) absentClass = "bg-yellow-500/5 text-yellow-400";
                            return (
                              <div
                                key={r.dni}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm ${absentClass}`}
                              >
                                <span>{r.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono opacity-70">#{rankPos}</span>
                                  <button
                                    onClick={() => handleAdd(date, r.dni)}
                                    disabled={busyDni === r.dni}
                                    title="Agregar asistencia"
                                    className="text-xs px-2 py-0.5 rounded bg-[var(--color-success)]/20 hover:bg-[var(--color-success)]/40 text-[var(--color-success)] disabled:opacity-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
