export const YEAR = 2026;
export const ADMIN_PIN = "2026";
export const CODE_DURATION_MS = 5 * 60 * 1000;

export const SUBJECTS = {
  ppii: "Practicas Profesionalizantes II",
  programacion: "Programacion",
};

export const GRADE_FIELDS = {
  tps: Array.from({ length: 12 }, (_, i) => `TP${i + 1}`),
  exams: ["Parcial 1", "Parcial 2"],
  projects: ["P0 Frontend", "P1 Sitio Web", "P2 Full Stack", "P3 Optativo"],
};

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or D/M/YYYY (common from Google Sheets in es-AR locale)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Google Sheets serial number (days since 1899-12-30)
  if (/^\d{5}$/.test(s)) {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + Number(s));
    return toLocalYMD(epoch);
  }

  // JS Date.toString() format: "Wed Mar 25 2026 00:00:00 GMT-0300 (...)"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return toLocalYMD(parsed);
  }

  return s;
}

function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr) {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return "Sin fecha";
  const d = new Date(normalized + "T12:00:00");
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}

export function formatTime() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Count weekdays (Mon-Fri) between two dates inclusive */
function countWeekdays(start, end) {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Get total class days up to today (Mar 1 - Oct 30, weekdays only) */
export function getClassDaysUpToToday() {
  const start = new Date(YEAR, 2, 1); // March 1
  const end = new Date(YEAR, 9, 30); // October 30
  const today = new Date();
  const limit = today < end ? today : end;
  if (today < start) return 0;
  return countWeekdays(start, limit);
}

/** Calculate ranking from students, attendance, and grades */
export function calculateRanking(students, attendance, grades, subject) {
  const totalDays = getClassDaysUpToToday();
  const subAtt = attendance[subject] || {};
  const subGrades = grades[subject] || {};

  // Normalización relativa: el máximo de la clase vale 1.0 de aporte al score
  const maxParticipation = students.reduce((max, st) => {
    const v = Number(subGrades[st.dni]?.["Participacion"] || 0);
    return v > max ? v : max;
  }, 0);

  return students
    .map((st) => {
      // Attendance
      let attended = 0;
      for (const date in subAtt) {
        const dnis = (subAtt[date] || "").split(",").filter(Boolean);
        if (dnis.includes(st.dni)) attended++;
      }
      const attPct = totalDays > 0 ? (attended / totalDays) * 100 : 0;

      // Grades
      const g = subGrades[st.dni] || {};
      const participation = Number(g["Participacion"] || 0);

      const tpValues = GRADE_FIELDS.tps.map((f) => g[f]).filter((v) => v != null && v !== "");
      const tpAvg = tpValues.length > 0 ? tpValues.reduce((a, b) => a + Number(b), 0) / tpValues.length : 0;

      const examValues = GRADE_FIELDS.exams.map((f) => g[f]).filter((v) => v != null && v !== "");
      const examAvg = examValues.length > 0 ? examValues.reduce((a, b) => a + Number(b), 0) / examValues.length : 0;

      const projValues = GRADE_FIELDS.projects.map((f) => g[f]).filter((v) => v != null && v !== "");
      const projAvg = projValues.length > 0 ? projValues.reduce((a, b) => a + Number(b), 0) / projValues.length : 0;

      const participationNorm = maxParticipation > 0 ? participation / maxParticipation : 0;

      const score =
        (attPct / 100) * 10 * 0.15 +
        participationNorm * 10 * 0.1 +
        (tpAvg / 10) * 0.3 +
        (examAvg / 10) * 0.25 +
        (projAvg / 10) * 0.2;

      return {
        ...st,
        attended,
        attPct,
        participation,
        tpAvg,
        examAvg,
        projAvg,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}
