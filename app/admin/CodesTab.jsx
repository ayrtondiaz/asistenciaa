"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { todayStr, generateCode, CODE_DURATION_MS } from "@/lib/utils";

export default function CodesTab() {
  const { students, attendance, codes, subject, showToast, persistCodes } = useApp();
  const [remaining, setRemaining] = useState(null);

  const activeCode = codes[subject];
  const today = todayStr();
  const subAtt = attendance[subject] || {};
  const todayDnis = (subAtt[today] || "").split(",").filter(Boolean);

  useEffect(() => {
    if (!activeCode) { setRemaining(null); return; }
    function tick() {
      const diff = new Date(activeCode.expiresAt) - new Date();
      setRemaining(diff > 0 ? diff : null);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCode]);

  const codeActive = remaining !== null && remaining > 0;
  const mins = remaining ? Math.floor(remaining / 60000) : 0;
  const secs = remaining ? Math.floor((remaining % 60000) / 1000) : 0;

  async function activateCode() {
    const newCode = generateCode();
    const newCodes = {
      ...codes,
      [subject]: { code: newCode, expiresAt: new Date(Date.now() + CODE_DURATION_MS).toISOString() },
    };
    await persistCodes(newCodes);
    showToast(`Codigo activado: ${newCode}`, "success");
  }

  async function deactivateCode() {
    const newCodes = { ...codes };
    delete newCodes[subject];
    await persistCodes(newCodes);
    showToast("Codigo desactivado", "info");
  }

  const presentStudents = students.filter((s) => todayDnis.includes(s.dni));

  return (
    <div>
      {/* Code management */}
      <div className="p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl mb-6">
        {codeActive ? (
          <div className="text-center">
            <p className="text-xs text-[var(--color-muted)] mb-1">Codigo activo</p>
            <p className="font-mono text-4xl font-bold tracking-[0.3em] mb-2">{activeCode.code}</p>
            <p className="font-mono text-lg text-[var(--color-success)]">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </p>
            <button
              onClick={deactivateCode}
              className="mt-4 px-4 py-2 bg-[var(--color-error)] text-white rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer"
            >
              Desactivar
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[var(--color-muted)] mb-4">No hay codigo activo</p>
            <button
              onClick={activateCode}
              className="px-6 py-2.5 bg-[var(--color-success)] text-white rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer"
            >
              Activar Codigo (5 min)
            </button>
          </div>
        )}
      </div>

      {/* Today's attendance */}
      <h3 className="font-medium text-sm mb-2">Presentes hoy ({presentStudents.length})</h3>
      {presentStudents.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Ninguno aun</p>
      ) : (
        <div className="space-y-1">
          {presentStudents.map((s) => (
            <div key={s.dni} className="flex items-center gap-3 px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg text-sm">
              <span className="font-mono text-xs text-[var(--color-muted)]">{s.dni}</span>
              <span className="font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
