"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { ADMIN_PIN } from "@/lib/utils";
import Spinner from "@/components/Spinner";
import CodesTab from "./CodesTab";
import ParticipationTab from "./ParticipationTab";
import GradesTab from "./GradesTab";
import StudentsTab from "./StudentsTab";
import AttendanceTab from "./AttendanceTab";

const TABS = [
  { key: "codes", label: "Codigos" },
  { key: "participation", label: "Participacion" },
  { key: "grades", label: "Notas" },
  { key: "students", label: "Alumnos" },
  { key: "attendance", label: "Asistencia" },
];

export default function AdminPage() {
  const { loading } = useApp();
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState("codes");

  if (loading) return <Spinner />;

  if (!authed) {
    return (
      <div className="max-w-xs mx-auto text-center animate-fade-in pt-12">
        <h2 className="font-serif text-2xl mb-4">Admin</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === ADMIN_PIN) setAuthed(true);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] text-sm font-mono text-center text-xl tracking-[0.5em] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "codes" && <CodesTab />}
      {tab === "participation" && <ParticipationTab />}
      {tab === "grades" && <GradesTab />}
      {tab === "students" && <StudentsTab />}
      {tab === "attendance" && <AttendanceTab />}
    </div>
  );
}
