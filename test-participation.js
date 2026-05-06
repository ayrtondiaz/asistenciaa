// Test: migracion legacy de participation y comportamiento de getParticipation /
// incrementParticipation cuando los datos viejos viven en grades.Participacion.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SCRIPT_PATH = path.join(
  "/sessions/zen-focused-goodall/mnt/AsistenciaNext",
  "appnuevoscript.js"
);

// ----- Mock SpreadsheetApp (mismo modelo que test-attendance) -----

function makeSheet(name, headers) {
  const rows = [headers.slice()];
  const sheet = {
    name, _rows: rows,
    getName() { return name; },
    getLastRow() {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i] && rows[i].some(v => v !== "" && v !== null && v !== undefined)) return i + 1;
      }
      return 0;
    },
    getLastColumn() { let m = 0; for (const r of rows) if (r && r.length > m) m = r.length; return m; },
    getDataRange() {
      const lr = sheet.getLastRow(), lc = sheet.getLastColumn();
      return makeRange(sheet, 1, 1, Math.max(lr, 1), Math.max(lc, headers.length));
    },
    getRange(r, c, nr = 1, nc = 1) { return makeRange(sheet, r, c, nr, nc); },
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
    getValue() { const r = sheet._rows[row - 1] || []; const v = r[col - 1]; return v === undefined ? "" : v; },
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
        const ra = sheet._rows[row - 1 + i] || [];
        const slice = [];
        for (let j = 0; j < numCols; j++) {
          const v = ra[col - 1 + j];
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
        const ra = sheet._rows[row - 1 + i];
        if (!ra) continue;
        for (let j = 0; j < numCols; j++) ra[col - 1 + j] = "";
      }
      return this;
    },
  };
}

const sheets = {};
const ss = {
  getSheetByName(n) { return sheets[n] || null; },
  insertSheet(n) { sheets[n] = makeSheet(n, []); return sheets[n]; },
  getSpreadsheetTimeZone() { return "America/Argentina/Buenos_Aires"; },
  _setSheet(n, h) { sheets[n] = makeSheet(n, h); return sheets[n]; },
};

const sandbox = {
  console,
  Utilities: {
    formatDate(d) {
      const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    },
  },
  SpreadsheetApp: {
    openById() { return ss; }, getActiveSpreadsheet() { return ss; }, flush() {},
  },
  LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput(s) { return { setMimeType() { return { _body: s }; } }; } },
  Logger: { log: () => {} },
};

const code = fs.readFileSync(SCRIPT_PATH, "utf8");
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx);

let passed = 0, failed = 0;
function assert(c, m) { if (c) { console.log("  PASS:", m); passed++; } else { console.log("  FAIL:", m); failed++; } }
function partRows() {
  const sh = sheets["participation"];
  if (!sh) return [];
  return sh._rows.slice(1).filter(r => r && r.some(v => v !== "" && v !== null && v !== undefined));
}
function gradesRows() {
  const sh = sheets["grades"];
  if (!sh) return [];
  return sh._rows.slice(1).filter(r => r && r.some(v => v !== "" && v !== null && v !== undefined));
}

// Setup: hoja students con 3 alumnos
function seedStudents() {
  const s = ss._setSheet("students", ["id", "name", "dni", "email", "createdAt"]);
  s._rows.push(["1", "Juan Perez", "11111111", "", ""]);
  s._rows.push(["2", "Maria Lopez", "22222222", "", ""]);
  s._rows.push(["3", "Luis Garcia", "33333333", "", ""]);
}

// ---- Test 1: caso del usuario - datos legacy en grades, participation vacia ----
console.log("\n[1] Datos legacy en grades.Participacion -> getParticipation rescata");
seedStudents();
const grades1 = ss._setSheet("grades", ["subject", "dni", "name", "field", "value"]);
grades1._rows.push(["ppii", "11111111", "Juan Perez", "Participacion", 5]);
grades1._rows.push(["ppii", "22222222", "Maria Lopez", "Participacion", 3]);
grades1._rows.push(["ppii", "11111111", "Juan Perez", "TP1", 80]); // no tocar
grades1._rows.push(["programacion", "33333333", "Luis Garcia", "Participacion", 7]);
ss._setSheet("participation", ["subject", "dni", "name", "count"]);

const resp1 = ctx.getParticipation();
assert(resp1.ok === true, "getParticipation ok");
assert(resp1.data.ppii && resp1.data.ppii["11111111"] === 5, "Juan ppii = 5 (rescatado)");
assert(resp1.data.ppii["22222222"] === 3, "Maria ppii = 3");
assert(resp1.data.programacion["33333333"] === 7, "Luis programacion = 7");

// La hoja participation ahora deberia tener las 3 filas migradas
const after1 = partRows();
assert(after1.length === 3, "participation tiene 3 filas tras migracion. Got " + after1.length);

// grades ya no debe tener filas de Participacion (solo TP1)
const gAfter1 = gradesRows();
const stillLegacy = gAfter1.filter(r => r[3] === "Participacion");
assert(stillLegacy.length === 0, "grades.Participacion fue limpiado. Got " + stillLegacy.length);
const stillTP = gAfter1.filter(r => r[3] === "TP1");
assert(stillTP.length === 1, "grades.TP1 NO se borro. Got " + stillTP.length);

// ---- Test 2: idempotencia - segunda llamada no duplica ----
console.log("\n[2] getParticipation es idempotente (segunda llamada no dobla)");
const resp2 = ctx.getParticipation();
assert(resp2.data.ppii["11111111"] === 5, "Juan ppii sigue en 5 (no doblo)");
assert(partRows().length === 3, "participation sigue con 3 filas");

// ---- Test 3: incrementParticipation rescata legacy antes de incrementar ----
console.log("\n[3] incrementParticipation no resetea valor legacy");
ss._setSheet("participation", ["subject", "dni", "name", "count"]);
const grades3 = ss._setSheet("grades", ["subject", "dni", "name", "field", "value"]);
grades3._rows.push(["ppii", "11111111", "Juan Perez", "Participacion", 10]);

// Antes del fix: incrementParticipation no veia los 10 legacy y dejaba el contador en 1.
// Ahora deberia migrar primero y luego incrementar a 11.
const resp3 = ctx.incrementParticipation({ subject: "ppii", dni: "11111111", delta: 1 });
assert(resp3.ok === true, "increment ok");
assert(resp3.data.count === 11, "Juan ppii pasa de 10 (legacy) a 11. Got " + resp3.data.count);

// ---- Test 4: si participation ya tenia valor, prevalece sobre legacy ----
console.log("\n[4] Participation autoritativa sobre grades legacy");
ss._setSheet("participation", ["subject", "dni", "name", "count"]);
const grades4 = ss._setSheet("grades", ["subject", "dni", "name", "field", "value"]);
grades4._rows.push(["ppii", "11111111", "Juan Perez", "Participacion", 100]);
// Pre-existing en participation
sheets["participation"]._rows.push(["ppii", "11111111", "Juan Perez", 2]);

const resp4 = ctx.getParticipation();
assert(resp4.data.ppii["11111111"] === 2, "Prevalece participation (2) sobre grades legacy (100). Got " + resp4.data.ppii["11111111"]);
// Y la fila legacy tambien debe limpiarse
const gAfter4 = gradesRows().filter(r => r[3] === "Participacion");
assert(gAfter4.length === 0, "fila legacy se limpia aunque participation prevalezca");

// ---- Test 5: sin grades sheet no rompe ----
console.log("\n[5] Sin grades sheet, getParticipation no rompe");
delete sheets["grades"];
ss._setSheet("participation", ["subject", "dni", "name", "count"]);
const resp5 = ctx.getParticipation();
assert(resp5.ok === true, "ok aun sin grades");
assert(Object.keys(resp5.data).length === 0, "data vacia");

// ---- Test 6: increment desde cero (alumno nuevo) ----
console.log("\n[6] incrementParticipation crea fila nueva si no existe");
seedStudents();
ss._setSheet("participation", ["subject", "dni", "name", "count"]);
const resp6 = ctx.incrementParticipation({ subject: "ppii", dni: "22222222", delta: 1 });
assert(resp6.ok === true, "ok");
assert(resp6.data.count === 1, "count=1");
assert(partRows().length === 1, "1 fila en participation");

// ---- Test 7: delta negativo no baja de 0 ----
console.log("\n[7] Delta negativo no baja de 0");
const resp7 = ctx.incrementParticipation({ subject: "ppii", dni: "22222222", delta: -5 });
assert(resp7.ok === true, "ok");
assert(resp7.data.count === 0, "count clamped a 0. Got " + resp7.data.count);

// ---- Test 8: fila legacy con value=0 no se importa pero se limpia ----
console.log("\n[8] Legacy con value=0 se limpia sin crear fila");
ss._setSheet("participation", ["subject", "dni", "name", "count"]);
const grades8 = ss._setSheet("grades", ["subject", "dni", "name", "field", "value"]);
grades8._rows.push(["ppii", "44444444", "Otro", "Participacion", 0]);
ctx.getParticipation();
assert(partRows().length === 0, "value=0 no crea fila en participation");
const gLeft8 = gradesRows().filter(r => r[3] === "Participacion");
assert(gLeft8.length === 0, "fila legacy con 0 igual se limpia");

console.log("\n=========================================");
console.log(`Resultado: ${passed} pass, ${failed} fail`);
console.log("=========================================");
process.exit(failed === 0 ? 0 : 1);
