"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { sheetsCall } from "@/lib/api";
import { loadLocal, saveLocal } from "@/lib/storage";
import { normalizeDate } from "@/lib/utils";

/** Normaliza las keys de fecha del objeto attendance a YYYY-MM-DD */
function normalizeAttendance(att) {
  if (!att || typeof att !== "object") return {};
  const out = {};
  for (const subj of Object.keys(att)) {
    out[subj] = {};
    const bySubj = att[subj] || {};
    for (const rawDate of Object.keys(bySubj)) {
      const norm = normalizeDate(rawDate) || rawDate;
      const incoming = bySubj[rawDate];
      const existing = out[subj][norm];
      if (existing) {
        // merge CSV sin duplicados si dos keys colapsan a la misma fecha
        const set = new Set(
          (existing + "," + incoming).split(",").map((v) => v.trim()).filter(Boolean)
        );
        out[subj][norm] = Array.from(set).join(",");
      } else {
        out[subj][norm] = incoming;
      }
    }
  }
  return out;
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [subject, setSubject] = useState("ppii");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [grades, setGrades] = useState({});
  const [codes, setCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [navVisibility, setNavVisibilityState] = useState({});
  const toastTimer = useRef(null);

  // Load nav visibility preferences from localStorage
  useEffect(() => {
    const saved = loadLocal("navVisibility");
    if (saved && typeof saved === "object") setNavVisibilityState(saved);
  }, []);

  const setNavVisibility = useCallback((next) => {
    setNavVisibilityState(next);
    saveLocal("navVisibility", next);
  }, []);

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
        const a = normalizeAttendance(remoteAtt);
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
        setAttendance(normalizeAttendance(loadLocal("attendance") || {}));
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
        navVisibility,
        setNavVisibility,
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
