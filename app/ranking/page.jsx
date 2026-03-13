"use client";

import { useApp } from "@/context/AppContext";
import { calculateRanking, getClassDaysUpToToday } from "@/lib/utils";
import Spinner from "@/components/Spinner";

export default function RankingPage() {
  const { students, attendance, grades, subject, loading } = useApp();

  if (loading) return <Spinner />;

  const ranking = calculateRanking(students, attendance, grades, subject);
  const totalDays = getClassDaysUpToToday();

  function attColor(pct) {
    if (pct >= 80) return "text-[var(--color-success)]";
    if (pct >= 60) return "text-[var(--color-warning)]";
    return "text-[var(--color-error)]";
  }

  if (ranking.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-muted)] animate-fade-in">
        <p>No hay alumnos registrados aun.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-serif text-2xl mb-1">Ranking</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4">{totalDays} clase{totalDays !== 1 ? "s" : ""} hasta hoy</p>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-accent)] text-white text-left">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Alumno</th>
              <th className="px-3 py-2 font-medium text-center">Asist.</th>
              <th className="px-3 py-2 font-medium text-center">Part.</th>
              <th className="px-3 py-2 font-medium text-center">TPs</th>
              <th className="px-3 py-2 font-medium text-center">Exam.</th>
              <th className="px-3 py-2 font-medium text-center">Proy.</th>
              <th className="px-3 py-2 font-medium text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr
                key={r.dni}
                className={`border-t border-[var(--color-border)] ${i < 3 ? "bg-[var(--color-success)]/5" : i % 2 === 0 ? "bg-[var(--color-card)]" : ""}`}
              >
                <td className="px-3 py-2 font-mono font-medium">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className={`px-3 py-2 text-center font-mono ${attColor(r.attPct)}`}>
                  {r.attended}
                </td>
                <td className="px-3 py-2 text-center font-mono">{r.participation}</td>
                <td className="px-3 py-2 text-center font-mono">{r.tpAvg.toFixed(1)}</td>
                <td className="px-3 py-2 text-center font-mono">{r.examAvg.toFixed(1)}</td>
                <td className="px-3 py-2 text-center font-mono">{r.projAvg.toFixed(1)}</td>
                <td className="px-3 py-2 text-center font-mono font-bold">{r.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weights legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
        <span>Asistencia 15%</span>
        <span>Participacion 10%</span>
        <span>TPs 30%</span>
        <span>Examenes 25%</span>
        <span>Proyectos 20%</span>
      </div>
    </div>
  );
}
