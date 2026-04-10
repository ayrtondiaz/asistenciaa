"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate, normalizeDate, calculateRanking } from "@/lib/utils";

export default function AttendanceTab() {
  const { students, attendance, grades, subject } = useApp();
  const [expandedDate, setExpandedDate] = useState(null);

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
          const dangerStart = Math.max(0, ranking.length - 15);

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
                  <p className="text-xs text-[var(--color-muted)] mb-2">
                    Alumnos presentes (ordenados por ranking)
                  </p>
                  <div className="space-y-1">
                    {sortedDnis.map((dni) => {
                      const rankPos = getRankPosition(dni);
                      const isDanger = ranking.length > 15 && rankPos > dangerStart;
                      return (
                        <div
                          key={dni}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm ${
                            isDanger
                              ? "bg-red-500/10 text-red-500"
                              : "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                          }`}
                        >
                          <span className="font-medium">{getStudentName(dni)}</span>
                          <span className="text-xs font-mono opacity-70">#{rankPos}</span>
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
                            const isDanger = ranking.length > 15 && rankPos > dangerStart;
                            return (
                              <div
                                key={r.dni}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm ${
                                  isDanger
                                    ? "bg-red-500/5 text-red-400"
                                    : "bg-[var(--color-border)]/30 text-[var(--color-muted)]"
                                }`}
                              >
                                <span>{r.name}</span>
                                <span className="text-xs font-mono opacity-70">#{rankPos}</span>
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
