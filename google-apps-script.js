// ============================================================
// ASISTENCIA — Google Apps Script v2 (no destructivo)
//
// Hojas necesarias (crear con estos nombres exactos):
//   students    → id | name | dni | email | createdAt
//   attendance  → subject | date | dnis
//   grades      → subject | dni | field | value
//   codes       → subject | code | expiresAt
//
// Mejoras respecto a v1:
//   - Las escrituras NO borran datos existentes, operan por fila
//   - addStudent / removeStudent: agregar o quitar un alumno individual
//   - addAttendance: agregar un DNI a una fecha sin reescribir todo
//   - setGrade: guardar una nota individual sin tocar las demas
//   - setCodes: upsert por materia, no borra las otras
//   - Validaciones basicas en cada operacion
//   - Las hojas se crean automaticamente si no existen
// ============================================================

// ---------- ENTRY POINT ----------

function doGet(e) {
  var action = (e.parameter.action || "").trim();
  var data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
  var result;

  try {
    switch (action) {
      // reads
      case "getStudents":    result = getStudents(); break;
      case "getAttendance":  result = getAttendance(); break;
      case "getGrades":      result = getGrades(); break;
      case "getCodes":       result = getCodes(); break;

      // granular writes (no borran nada)
      case "addStudent":     result = addStudent(data); break;
      case "removeStudent":  result = removeStudent(data); break;
      case "addAttendance":  result = addAttendance(data); break;
      case "setGrade":       result = setGrade(data); break;
      case "setCodes":       result = setCodes(data); break;

      // bulk writes (compatibilidad con v1 — pero ya NO borran todo)
      case "saveStudents":   result = saveStudentsBulk(data); break;
      case "saveAttendance": result = saveAttendanceBulk(data); break;
      case "saveGrades":     result = saveGradesBulk(data); break;
      case "saveCodes":      result = saveCodes(data); break;

      default:
        result = { ok: false, error: "Accion no valida: " + action };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- HELPERS ----------

/** Obtiene o crea una hoja con headers */
function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

/** Busca la fila donde col (1-based) === value. Devuelve row number o -1. */
function findRow(sheet, col, value) {
  var data = sheet.getDataRange().getValues();
  var str = String(value);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col - 1]) === str) return i + 1; // row is 1-indexed
  }
  return -1;
}

/** Busca la fila donde col1 === v1 AND col2 === v2. */
function findRow2(sheet, col1, v1, col2, v2) {
  var data = sheet.getDataRange().getValues();
  var s1 = String(v1), s2 = String(v2);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col1 - 1]) === s1 && String(data[i][col2 - 1]) === s2) return i + 1;
  }
  return -1;
}

/** Busca la fila donde col1 === v1 AND col2 === v2 AND col3 === v3. */
function findRow3(sheet, col1, v1, col2, v2, col3, v3) {
  var data = sheet.getDataRange().getValues();
  var s1 = String(v1), s2 = String(v2), s3 = String(v3);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col1 - 1]) === s1 && String(data[i][col2 - 1]) === s2 && String(data[i][col3 - 1]) === s3) {
      return i + 1;
    }
  }
  return -1;
}

// ===================== STUDENTS =====================

function getStudents() {
  var sheet = getOrCreateSheet("students", ["id", "name", "dni", "email", "createdAt"]);
  var data = sheet.getDataRange().getValues();
  var students = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      students.push({
        id: String(data[i][0]),
        name: data[i][1],
        dni: String(data[i][2]),
        email: data[i][3] || "",
        createdAt: data[i][4]
      });
    }
  }
  return { ok: true, data: students };
}

/** Agrega UN alumno. data = { id, name, dni, email?, createdAt } */
function addStudent(data) {
  if (!data || !data.dni || !data.name) {
    return { ok: false, error: "Faltan campos: name, dni" };
  }
  var sheet = getOrCreateSheet("students", ["id", "name", "dni", "email", "createdAt"]);

  // Verificar duplicado por DNI
  if (findRow(sheet, 3, data.dni) !== -1) {
    return { ok: false, error: "DNI ya registrado: " + data.dni };
  }

  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 5).setValues([[
    data.id || Date.now().toString(),
    data.name,
    data.dni,
    data.email || "",
    data.createdAt || new Date().toISOString()
  ]]);
  return { ok: true };
}

/** Elimina UN alumno por DNI. data = { dni } */
function removeStudent(data) {
  if (!data || !data.dni) return { ok: false, error: "Falta campo: dni" };
  var sheet = getOrCreateSheet("students", ["id", "name", "dni", "email", "createdAt"]);
  var row = findRow(sheet, 3, data.dni);
  if (row === -1) return { ok: false, error: "DNI no encontrado: " + data.dni };
  sheet.deleteRow(row);
  return { ok: true };
}

/** Bulk save compatible con v1 — sincroniza sin borrar todo. */
function saveStudentsBulk(students) {
  if (!Array.isArray(students)) return { ok: false, error: "Se esperaba un array" };
  var sheet = getOrCreateSheet("students", ["id", "name", "dni", "email", "createdAt"]);

  // Leer DNIs existentes
  var data = sheet.getDataRange().getValues();
  var existing = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][2]) existing[String(data[i][2])] = i + 1;
  }

  // Agregar los que no existen
  for (var j = 0; j < students.length; j++) {
    var st = students[j];
    if (!existing[String(st.dni)]) {
      var row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1, 1, 5).setValues([[
        st.id || Date.now().toString(),
        st.name,
        st.dni,
        st.email || "",
        st.createdAt || new Date().toISOString()
      ]]);
    }
  }

  // Eliminar los que ya no estan en el array
  var incomingDnis = {};
  for (var k = 0; k < students.length; k++) {
    incomingDnis[String(students[k].dni)] = true;
  }
  // Recorrer de abajo hacia arriba para no romper indices al borrar
  data = sheet.getDataRange().getValues();
  for (var m = data.length - 1; m >= 1; m--) {
    var dni = String(data[m][2]);
    if (dni && !incomingDnis[dni]) {
      sheet.deleteRow(m + 1);
    }
  }

  return { ok: true };
}

// ===================== ATTENDANCE =====================

function getAttendance() {
  var sheet = getOrCreateSheet("attendance", ["subject", "date", "dnis"]);
  var data = sheet.getDataRange().getValues();
  var attendance = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      var subj = String(data[i][0]);
      var date = String(data[i][1]);
      var dnis = data[i][2] ? String(data[i][2]) : "";
      if (!attendance[subj]) attendance[subj] = {};
      // Merge: soporta multiples filas con el mismo subject+date
      var existing = attendance[subj][date] || "";
      attendance[subj][date] = existing ? mergeCSV(existing, dnis) : dnis;
    }
  }
  return { ok: true, data: attendance };
}

/** Agrega UN dni a una fecha. data = { subject, date, dni } */
function addAttendance(data) {
  if (!data || !data.subject || !data.date || !data.dni) {
    return { ok: false, error: "Faltan campos: subject, date, dni" };
  }
  var sheet = getOrCreateSheet("attendance", ["subject", "date", "dnis"]);
  var row = findRow2(sheet, 1, data.subject, 2, data.date);

  if (row !== -1) {
    // La fila ya existe, agregar DNI si no esta
    var current = String(sheet.getRange(row, 3).getValue() || "");
    var list = current ? current.split(",") : [];
    if (list.indexOf(String(data.dni)) !== -1) {
      return { ok: false, error: "DNI ya registrado en esta fecha" };
    }
    list.push(String(data.dni));
    sheet.getRange(row, 3).setValue(list.join(","));
  } else {
    // Crear nueva fila
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 3).setValues([[data.subject, data.date, String(data.dni)]]);
  }
  return { ok: true };
}

/** Bulk save compatible con v1 — merge, no borra. */
function saveAttendanceBulk(attendance) {
  if (!attendance || typeof attendance !== "object") {
    return { ok: false, error: "Se esperaba un objeto" };
  }
  var sheet = getOrCreateSheet("attendance", ["subject", "date", "dnis"]);
  var subjects = Object.keys(attendance);

  for (var i = 0; i < subjects.length; i++) {
    var subj = subjects[i];
    var dates = Object.keys(attendance[subj]);
    for (var j = 0; j < dates.length; j++) {
      var date = dates[j];
      var dnis = attendance[subj][date];
      // Normalizar: puede venir como array o string
      var dnisStr = Array.isArray(dnis) ? dnis.join(",") : String(dnis);
      var row = findRow2(sheet, 1, subj, 2, date);

      if (row !== -1) {
        // Merge: agregar DNIs nuevos a los existentes
        var current = String(sheet.getRange(row, 3).getValue() || "");
        var merged = mergeCSV(current, dnisStr);
        sheet.getRange(row, 3).setValue(merged);
      } else {
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 1, 1, 3).setValues([[subj, date, dnisStr]]);
      }
    }
  }
  return { ok: true };
}

/** Combina dos strings CSV sin duplicados */
function mergeCSV(existing, incoming) {
  var set = {};
  var parts = (existing + "," + incoming).split(",");
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var v = parts[i].trim();
    if (v && !set[v]) {
      set[v] = true;
      result.push(v);
    }
  }
  return result.join(",");
}

// ===================== GRADES =====================

function getGrades() {
  var sheet = getOrCreateSheet("grades", ["subject", "dni", "field", "value"]);
  var data = sheet.getDataRange().getValues();
  var grades = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      var subj = String(data[i][0]);
      var dni = String(data[i][1]);
      var field = data[i][2];
      var value = data[i][3];
      if (!grades[subj]) grades[subj] = {};
      if (!grades[subj][dni]) grades[subj][dni] = {};
      grades[subj][dni][field] = value === "" || value === null ? null : Number(value);
    }
  }
  return { ok: true, data: grades };
}

/** Guarda UNA nota. data = { subject, dni, field, value } */
function setGrade(data) {
  if (!data || !data.subject || !data.dni || !data.field) {
    return { ok: false, error: "Faltan campos: subject, dni, field" };
  }
  var sheet = getOrCreateSheet("grades", ["subject", "dni", "field", "value"]);
  var row = findRow3(sheet, 1, data.subject, 2, data.dni, 3, data.field);

  var val = (data.value !== null && data.value !== undefined && data.value !== "") ? Number(data.value) : "";

  if (row !== -1) {
    // Actualizar valor existente
    sheet.getRange(row, 4).setValue(val);
  } else {
    // Nueva fila
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 4).setValues([[data.subject, data.dni, data.field, val]]);
  }
  return { ok: true };
}

/** Bulk save compatible con v1 — upsert por fila, no borra. */
function saveGradesBulk(grades) {
  if (!grades || typeof grades !== "object") {
    return { ok: false, error: "Se esperaba un objeto" };
  }
  var sheet = getOrCreateSheet("grades", ["subject", "dni", "field", "value"]);
  var subjects = Object.keys(grades);

  for (var i = 0; i < subjects.length; i++) {
    var subj = subjects[i];
    var dnis = Object.keys(grades[subj]);
    for (var j = 0; j < dnis.length; j++) {
      var dni = dnis[j];
      var fields = Object.keys(grades[subj][dni]);
      for (var k = 0; k < fields.length; k++) {
        var field = fields[k];
        var val = grades[subj][dni][field];
        val = (val !== null && val !== undefined && val !== "") ? Number(val) : "";

        var row = findRow3(sheet, 1, subj, 2, dni, 3, field);
        if (row !== -1) {
          sheet.getRange(row, 4).setValue(val);
        } else {
          var newRow = sheet.getLastRow() + 1;
          sheet.getRange(newRow, 1, 1, 4).setValues([[subj, dni, field, val]]);
        }
      }
    }
  }
  return { ok: true };
}

// ===================== CODES =====================

function getCodes() {
  var sheet = getOrCreateSheet("codes", ["subject", "code", "expiresAt"]);
  var data = sheet.getDataRange().getValues();
  var codes = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      var subj = String(data[i][0]);
      codes[subj] = {
        code: String(data[i][1]),
        expiresAt: String(data[i][2])
      };
    }
  }
  return { ok: true, data: codes };
}

/** Guarda codigos por materia (upsert). data = { subject: { code, expiresAt } | null } */
function setCodes(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Se esperaba un objeto" };
  }
  var sheet = getOrCreateSheet("codes", ["subject", "code", "expiresAt"]);
  var subjects = Object.keys(data);

  for (var i = 0; i < subjects.length; i++) {
    var subj = subjects[i];
    var row = findRow(sheet, 1, subj);

    if (data[subj] === null || data[subj] === undefined) {
      // Eliminar codigo de esta materia
      if (row !== -1) sheet.deleteRow(row);
    } else {
      if (row !== -1) {
        // Actualizar
        sheet.getRange(row, 2, 1, 2).setValues([[data[subj].code, data[subj].expiresAt]]);
      } else {
        // Insertar
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 1, 1, 3).setValues([[subj, data[subj].code, data[subj].expiresAt]]);
      }
    }
  }
  return { ok: true };
}

/** Bulk save compatible con v1. */
function saveCodes(codes) {
  return setCodes(codes);
}
