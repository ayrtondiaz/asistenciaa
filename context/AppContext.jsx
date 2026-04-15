"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { sheetsCall } from "@/lib/api";
import { loadLocal, saveLocal } from "@/lib/storage";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [subject, setSubject] = useState("ppii");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [grades, setGrades] = useState({});
  const [codes, setCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = "info") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Load all data on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [remoteStudents, remoteAtt, remoteGrades, remoteCodes] = await Promise.all([
          sheetsCall("getStudents"),
          sheetsCall("getAttendance"),
          sheetsCall("getGrades"),
          sheetsCall("getCodes"),
        ]);
        const s = Array.isArray(remoteStudents) ? remoteStudents : [];
        const a = remoteAtt && typeof remoteAtt === "object" ? remoteAtt : {};
        const g = remoteGrades && typeof remoteGrades === "object" ? remoteGrades : {};
        const c = remoteCodes && typeof remoteCodes === "object" ? remoteCodes : {};

        setStudents(s);
        setAttendance(a);
        setGrades(g);
        setCodes(c);
        saveLocal("students", s);
        saveLocal("attendance", a);
        saveLocal("grades", g);
        saveLocal("codes", c);
      } catch {
        setStudents(loadLocal("students") || []);
        setAttendance(loadLocal("attendance") || {});
        setGrades(loadLocal("grades") || {});
        setCodes(loadLocal("codes") || {});
      }
      setLoading(false);
    }
    load();
  }, []);

  // --- Granular operations (new API v2) ---

  /** Agrega un alumno nuevo */
  const addStudent = useCallback(async (student) => {
    setStudents((prev) => {
      const next = [...prev, student];
      saveLocal("students", next);
      return next;
    });
    await sheetsCall("addStudent", student);
  }, []);

  /** Elimina un alumno por DNI */
  const removeStudent = useCallback(async (dni) => {
    setStudents((prev) => {
      const next = prev.filter((s) => s.dni !== dni);
      saveLocal("students", next);
      return next;
    });
    await sheetsCall("removeStudent", { dni });
  }, []);

  /** Registra asistencia de un DNI para una fecha y materia */
  const addAttendance = useCallback(async (subj, date, dni) => {
    setAttendance((prev) => {
      const next = { ...prev };
      if (!next[subj]) next[subj] = {};
      const existing = next[subj][date] || "";
      const list = existing ? existing.split(",").filter(Boolean) : [];
      if (!list.includes(String(dni))) list.push(String(dni));
      next[subj][date] = list.join(",");
      saveLocal("attendance", next);
      return next;
    });
    await sheetsCall("addAttendance", { subject: subj, date, dni });
  }, []);

  /** Quita un DNI de una fecha y materia */
  const removeAttendance = useCallback(async (subj, date, dni) => {
    setAttendance((prev) => {
      const next = { ...prev };
      if (!next[subj] || next[subj][date] == null) return prev;
      const list = String(next[subj][date]).split(",").filter(Boolean).filter((d) => d !== String(dni));
      next[subj] = { ...next[subj], [date]: list.join(",") };
      saveLocal("attendance", next);
      return next;
    });
    await sheetsCall("removeAttendance", { subject: subj, date, dni });
  }, []);

  /** Guarda una nota individual */
  const setGrade = useCallback(async (subj, dni, field, value) => {
    setGrades((prev) => {
      const next = { ...prev };
      if (!next[subj]) next[subj] = {};
      if (!next[subj][dni]) next[subj][dni] = {};
      next[subj][dni][field] = value === "" || value === null ? null : Number(value);
      saveLocal("grades", next);
      return next;
    });
    await sheetsCall("setGrade", { subject: subj, dni, field, value });
  }, []);

  /** Activa/desactiva codigos (upsert por materia) */
  const persistCodes = useCallback(async (newCodes) => {
    setCodes(newCodes);
    saveLocal("codes", newCodes);
    try { await sheetsCall("setCodes", newCodes); } catch { /* silent */ }
  }, []);

  // --- Bulk fallbacks (kept for compatibility) ---

  const persistStudents = useCallback(async (newStudents) => {
    setStudents(newStudents);
    saveLocal("students", newStudents);
    try { await sheetsCall("saveStudents", newStudents); } catch { /* silent */ }
  }, []);

  const persistAttendance = useCallback(async (newAtt) => {
    setAttendance(newAtt);
    saveLocal("attendance", newAtt);
    try { await sheetsCall("saveAttendance", newAtt); } catch { /* silent */ }
  }, []);

  const persistGrades = useCallback(async (newGrades) => {
    setGrades(newGrades);
    saveLocal("grades", newGrades);
    try { await sheetsCall("saveGrades", newGrades); } catch { /* silent */ }
  }, []);

  return (
    <AppContext.Provider
      value={{
        subject,
        setSubject,
        students,
        attendance,
        grades,
        codes,
        loading,
        toast,
        showToast,
        // granular (preferred)
        addStudent,
        removeStudent,
        addAttendance,
        removeAttendance,
        setGrade,
        // bulk (compatibility)
        persistStudents,
        persistAttendance,
        persistGrades,
        persistCodes,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
