// Test harness para el Apps Script de asistencia.
// Mockea SpreadsheetApp / LockService / Utilities con una hoja en memoria,
// inyecta las funciones del script y verifica:
//   1) addAttendance crea una fila por (subject, date, dni)
//   2) Multiples alumnos en la misma fecha quedan en filas separadas
//   3) Llamadas concurrentes (Promise.all) no se pisan
//   4) removeAttendance borra la fila correcta
//   5) getAttendance reagrupa en CSV por (subject, date) para el frontend
//   6) Carga manual desde admin (varios add seguidos) tampoco mete todo en una celda
//   7) Migracion: una hoja con CSV viejo se expande a filas individuales
//   8) saveAttendanceBulk inserta una fila por dni y deduplica

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SCRIPT_PATH = path.join(
  "/sessions/zen-focused-goodall/mnt/AsistenciaNext",
  "appnuevoscript.js"
);

// ---------- Mock SpreadsheetApp ----------

function makeSheet(name, headers) {
  // Filas almacenadas como array de arrays. Indice 0 = header.
  const rows = [headers.slice()];
  // numberFormat por celda (no usado en logica, solo para no romper el codigo)
  const fmt = {};

  const sheet = {
    name,
    _rows: rows,
    _fmt: fmt,
    getName() { return name; },
    getLastRow() {
      // ultima fila con algun contenido
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i] && rows[i].some(v => v !== "" && v !== null && v !== undefined)) return i + 1;
      }
      return 0;
    },
    getLastColumn() {
      let max = 0;
      for (const r of rows) if (r && r.length > max) max = r.length;
      return max;
    },
    getDataRange() {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      return makeRange(sheet, 1, 1, Math.max(lastRow, 1), Math.max(lastCol, headers.length));
    },
    getRange(...args) {
      // (row, col) | (row, col, numRows) | (row, col, numRows, numCols)
      const [r, c, nr = 1, nc = 1] = args;
      return makeRange(sheet, r, c, nr, nc);
    },
    insertColumnBefore(col) {
      for (const row of rows) {
        while (row.length < col - 1) row.push("");
        row.splice(col - 1, 0, "");
      }
    },
    deleteRow(row) { rows.splice(row - 1, 1); },
    clear() { rows.length = 0; rows.push(headers.slice()); },
  };
  return sheet;
}

function makeRange(sheet, row, col, numRows, numCols) {
  return {
    getValue() {
      const r = sheet._rows[row - 1] || [];
      const v = r[col - 1];
      return v === undefined ? "" : v;
    },
    setValue(v) {
      while (sheet._rows.length < row) sheet._rows.push([]);
      const r = sheet._rows[row - 1];
      while (r.length < col) r.push("");
      r[col - 1] = v;
      return this;
    },
    getValues() {
      const out = [];
      for (let i = 0; i < numRows; i++) {
        const rowArr = sheet._rows[row - 1 + i] || [];
        const slice = [];
        for (let j = 0; j < numCols; j++) {
          const v = rowArr[col - 1 + j];
          slice.push(v === undefined ? "" : v);
        }
        out.push(slice);
      }
      return out;
    },
    setValues(values) {
      for (let i = 0; i < values.length; i++) {
        while (sheet._rows.length < row + i) sheet._rows.push([]);
        const r = sheet._rows[row - 1 + i];
        for (let j = 0; j < values[i].length; j++) {
          while (r.length < col + j) r.push("");
          r[col - 1 + j] = values[i][j];
        }
      }
      return this;
    },
    setNumberFormat() { return this; },
    setFontWeight() { return this; },
    clearContent() {
      for (let i = 0; i < numRows; i++) {
        const rowArr = sheet._rows[row - 1 + i];
        if (!rowArr) continue;
        for (let j = 0; j < numCols; j++) {
          rowArr[col - 1 + j] = "";
        }
      }
      return this;
    },
  };
}

function makeSpreadsheet() {
  const sheets = {};
  return {
    getSheetByName(name) { return sheets[name] || null; },
    insertSheet(name) {
      sheets[name] = makeSheet(name, []);
      return sheets[name];
    },
    getSpreadsheetTimeZone() { return "America/Argentina/Buenos_Aires"; },
    _sheets: sheets,
    _setSheet(name, headers) {
      sheets[name] = makeSheet(name, headers);
      return sheets[name];
    },
  };
}

const ss = makeSpreadsheet();

// ---------- Mock APIs globales ----------

const sandbox = {
  console,
  Utilities: {
    formatDate(d, tz, fmt) {
      // soporta solo "yyyy-MM-dd"
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    },
  },
  SpreadsheetApp: {
    openById() { return ss; },
    getActiveSpreadsheet() { return ss; },
    flush() { /* noop */ },
  },
  LockService: {
    getScriptLock() {
      // Lock simple: como JS es single-threaded, basta devolver un objeto con waitLock/releaseLock noop
      return { waitLock() {}, releaseLock() {} };
    },
  },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput(s) { return { setMimeType() { return { _body: s }; }, _body: s }; },
  },
  Logger: { log: () => {} },
};

// Importar el script: lo cargamos en un contexto VM compartido
const code = fs.readFileSync(SCRIPT_PATH, "utf8");
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx);

// Helpers para inspeccionar la hoja
function dumpAttendanceRows() {
  const sh = ss._sheets["attendance"];
  if (!sh) return [];
  return sh._rows.slice(1).filter(r => r && r.some(v => v !== "" && v !== null && v !== undefined));
}

// ---------- Tests ----------

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log("  PASS:", msg); passed++; }
  else { console.log("  FAIL:", msg); failed++; }
}

function resetSheet() {
  ss._setSheet("attendance", ["subject", "date", "dni"]);
}

// 1) addAttendance: una fila por dni
console.log("\n[1] addAttendance - una fila por (subject, date, dni)");
resetSheet();
ctx.addAttendance({ subject: "ppii", date: "2026-04-29", dni: "44864106" });
let rows = dumpAttendanceRows();
assert(rows.length === 1, "se creo 1 fila tras 1 alumno");
assert(rows[0][0] === "ppii" && rows[0][1] === "2026-04-29" && rows[0][2] === "44864106",
  "fila correcta: " + JSON.stringify(rows[0]));

// 2) Multiples alumnos misma fecha -> filas separadas
console.log("\n[2] Multiples alumnos misma fecha = filas separadas");
resetSheet();
ctx.addAttendance({ subject: "ppii", date: "2026-04-29", dni: "11111111" });
ctx.addAttendance({ subject: "ppii", date: "2026-04-29", dni: "22222222" });
ctx.addAttendance({ subject: "ppii", date: "2026-04-29", dni: "33333333" });
rows = dumpAttendanceRows();
assert(rows.length === 3, "3 alumnos -> 3 filas (no 1 con CSV). Got " + rows.length);
assert(rows.every(r => r[2].toString().indexOf(",") === -1),
  "ninguna celda contiene coma (no hay CSV) -> " + JSON.stringify(rows.map(r => r[2])));
const dnisSet = new Set(rows.map(r => r[2]));
assert(dnisSet.has("11111111") && dnisSet.has("22222222") && dnisSet.has("33333333"),
  "los 3 DNIs estan presentes en filas distintas");

// 3) Concurrencia: Promise.all simula varios alumnos al mismo tiempo
console.log("\n[3] Concurrencia: Promise.all con 5 alumnos al mismo tiempo");
resetSheet();
(async () => {
  await Promise.all([
    Promise.resolve().then(() => ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000001" })),
    Promise.resolve().then(() => ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000002" })),
    Promise.resolve().then(() => ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000003" })),
    Promise.resolve().then(() => ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000004" })),
    Promise.resolve().then(() => ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000005" })),
  ]);
  rows = dumpAttendanceRows();
  assert(rows.length === 5, "5 alumnos concurrentes -> 5 filas. Got " + rows.length);

  // 4) DNI duplicado se rechaza, no crea fila extra
  console.log("\n[4] DNI duplicado para misma fecha");
  const dup = ctx.addAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000001" });
  rows = dumpAttendanceRows();
  assert(dup && dup.ok === false, "addAttendance retorna { ok:false } por duplicado");
  assert(rows.length === 5, "no se creo fila extra. Got " + rows.length);

  // 5) removeAttendance borra solo esa fila
  console.log("\n[5] removeAttendance borra solo la fila objetivo");
  ctx.removeAttendance({ subject: "ppii", date: "2026-05-01", dni: "10000003" });
  rows = dumpAttendanceRows();
  assert(rows.length === 4, "tras remove -> 4 filas. Got " + rows.length);
  assert(!rows.some(r => r[2] === "10000003"), "10000003 ya no esta");
  assert(rows.some(r => r[2] === "10000001"), "10000001 sigue");

  // 6) getAttendance reagrupa CSV para el frontend
  console.log("\n[6] getAttendance devuelve CSV por (subject,date) al frontend");
  const got = ctx.getAttendance();
  assert(got.ok === true, "getAttendance ok");
  const csv = got.data.ppii["2026-05-01"];
  const parts = (csv || "").split(",");
  assert(parts.length === 4, "CSV de la fecha con 4 DNIs. Got: " + csv);
  assert(parts.indexOf("10000001") !== -1 && parts.indexOf("10000002") !== -1,
    "CSV contiene los DNIs esperados");

  // 7) Admin agrega alumnos manualmente (mismo flujo, debe seguir igual)
  console.log("\n[7] Admin agrega varios alumnos manualmente desde el panel");
  resetSheet();
  // Simula click "+" en AttendanceTab para 4 alumnos
  ctx.addAttendance({ subject: "ppii", date: "2026-04-15", dni: "20000001" });
  ctx.addAttendance({ subject: "ppii", date: "2026-04-15", dni: "20000002" });
  ctx.addAttendance({ subject: "ppii", date: "2026-04-15", dni: "20000003" });
  ctx.addAttendance({ subject: "ppii", date: "2026-04-15", dni: "20000004" });
  rows = dumpAttendanceRows();
  assert(rows.length === 4, "admin: 4 add -> 4 filas. Got " + rows.length);
  assert(rows.every(r => r[2].toString().indexOf(",") === -1), "ninguna fila tiene CSV");

  // 8) Migracion: hoja vieja con CSV se expande automaticamente
  console.log("\n[8] Migracion automatica de hoja vieja con CSV");
  // Crea manualmente una hoja con esquema viejo
  const old = ss._setSheet("attendance", ["subject", "date", "dnis"]);
  old._rows.push(["ppii", "2026-03-01", "55555555,66666666,77777777"]);
  old._rows.push(["lyc", "2026-03-02", "88888888"]);
  // Trigger: cualquier llamada que use getAttendanceSheet detona la migracion
  const got2 = ctx.getAttendance();
  rows = dumpAttendanceRows();
  // Esperado: 4 filas (3 ppii + 1 lyc), header pasa a "dni"
  const header = ss._sheets["attendance"]._rows[0];
  assert(String(header[2]).toLowerCase() === "dni", "header migrado a 'dni'. Got " + header[2]);
  assert(rows.length === 4, "migracion expandio CSV a 4 filas. Got " + rows.length);
  assert(got2.data.ppii["2026-03-01"].split(",").length === 3,
    "getAttendance reagrupa los 3 DNIs de ppii como CSV");
  assert(got2.data.lyc["2026-03-02"] === "88888888", "lyc tiene 1 DNI");

  // 9) saveAttendanceBulk inserta una fila por dni y deduplica
  console.log("\n[9] saveAttendanceBulk: una fila por dni + dedupe");
  resetSheet();
  ctx.addAttendance({ subject: "ppii", date: "2026-06-01", dni: "30000001" });
  // Bulk con 3 dnis (uno repetido) en CSV
  ctx.saveAttendanceBulk({
    ppii: { "2026-06-01": "30000001,30000002,30000003" },
    lyc:  { "2026-06-02": ["40000001", "40000002"] },
  });
  rows = dumpAttendanceRows();
  // ppii/2026-06-01: 3 filas (la pre-existente + 2 nuevas), lyc: 2 filas
  const ppiiRows = rows.filter(r => r[0] === "ppii" && r[1] === "2026-06-01");
  const lycRows = rows.filter(r => r[0] === "lyc" && r[1] === "2026-06-02");
  assert(ppiiRows.length === 3, "ppii: 3 filas (sin duplicar 30000001). Got " + ppiiRows.length);
  assert(lycRows.length === 2, "lyc: 2 filas. Got " + lycRows.length);

  console.log("\n=========================================");
  console.log(`Resultado: ${passed} pass, ${failed} fail`);
  console.log("=========================================");
  process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
  console.error("Error en tests:", err);
  process.exit(2);
});
