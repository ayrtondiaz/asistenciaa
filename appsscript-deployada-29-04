// ============================================================
// ASISTENCIA — Google Apps Script v2 (no destructivo)
//
// Hojas necesarias (crear con estos nombres exactos):
//   students      → id | name | dni | email | createdAt
//   attendance    → subject | date | dnis
//   grades        → subject | dni | name | field | value
//   codes         → subject | code | expiresAt
//   participation → subject | dni | name | count
//
// Mejoras respecto a v1:
//   - Las escrituras NO borran datos existentes, operan por fila
//   - addStudent / removeStudent: agregar o quitar un alumno individual
//   - addAttendance / removeAttendance: agregar o quitar un DNI de una fecha
//   - setGrade: guardar una nota individual sin tocar las demas
//   - setCodes: upsert por materia, no borra las otras
//   - incrementParticipation: contador atomico por (subject, dni) en hoja propia
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
            case "getStudents": result = getStudents(); break;
            case "getAttendance": result = getAttendance(); break;
            case "getGrades": result = getGrades(); break;
            case "getCodes": result = getCodes(); break;
            case "getParticipation": result = getParticipation(); break;

            // granular writes (no borran nada)
            case "addStudent": result = addStudent(data); break;
            case "removeStudent": result = removeStudent(data); break;
            case "addAttendance": result = addAttendance(data); break;
            case "removeAttendance": result = removeAttendance(data); break;
            case "setGrade": result = setGrade(data); break;
            case "setCodes": result = setCodes(data); break;
            case "incrementParticipation": result = incrementParticipation(data); break;
            case "setParticipation": result = setParticipation(data); break;

            // bulk writes (compatibilidad con v1 — pero ya NO borran todo)
            case "saveStudents": result = saveStudentsBulk(data); break;
            case "saveAttendance": result = saveAttendanceBulk(data); break;
            case "saveGrades": result = saveGradesBulk(data); break;
            case "saveCodes": result = saveCodes(data); break;

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

/**
 * Convierte un valor de celda (Date o string) a "yyyy-MM-dd" usando la
 * timezone del spreadsheet. Evita que diferencias entre la zona horaria del
 * spreadsheet y la del runtime del script desplacen el día al leer/escribir.
 */
function dateToYMD(v) {
    if (v === null || v === undefined || v === "") return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
        var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
        return Utilities.formatDate(v, tz, "yyyy-MM-dd");
    }
    var s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    }
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        var tz2 = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
        return Utilities.formatDate(parsed, tz2, "yyyy-MM-dd");
    }
    return s;
}

/** Busca la fila de attendance por subject+date, normalizando la fecha de la celda. */
function findAttendanceRow(sheet, subject, dateYMD) {
    var data = sheet.getDataRange().getValues();
    var sSubj = String(subject);
    var sYMD = String(dateYMD);
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === sSubj && dateToYMD(data[i][1]) === sYMD) return i + 1;
    }
    return -1;
}

/**
 * Asegura que exista una columna con el nombre dado. Si no existe, la inserta
 * justo despues de `insertAfterColName` y (opcionalmente) rellena valores con
 * `defaultValueFn(row, sheet)`. Retorna la posicion 1-based de la columna.
 */
function ensureColumn(sheet, colName, insertAfterColName, defaultValueFn) {
    var lastCol = Math.max(1, sheet.getLastColumn());
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var target = String(colName).toLowerCase();
    for (var i = 0; i < headers.length; i++) {
        if (String(headers[i]).toLowerCase() === target) return i + 1;
    }
    var after = String(insertAfterColName).toLowerCase();
    var insertAt = headers.length + 1;
    for (var j = 0; j < headers.length; j++) {
        if (String(headers[j]).toLowerCase() === after) {
            insertAt = j + 2;
            break;
        }
    }
    sheet.insertColumnBefore(insertAt);
    sheet.getRange(1, insertAt).setValue(colName).setFontWeight("bold");
    if (typeof defaultValueFn === "function") {
        var lastRow = sheet.getLastRow();
        for (var r = 2; r <= lastRow; r++) {
            var val = defaultValueFn(r, sheet);
            if (val !== undefined && val !== null && val !== "") {
                sheet.getRange(r, insertAt).setValue(val);
            }
        }
    }
    return insertAt;
}

/** Busca el nombre de un alumno por DNI en la hoja students. */
function getStudentNameByDni(dni) {
    var sheet = getOrCreateSheet("students", ["id", "name", "dni", "email", "createdAt"]);
    var row = findRow(sheet, 3, dni);
    if (row === -1) return "";
    return String(sheet.getRange(row, 2).getValue() || "");
}

/** Migra grades al esquema con columna name (col 3). Idempotente. */
function ensureGradesSchema(sheet) {
    ensureColumn(sheet, "name", "dni", function (row, sh) {
        var dni = String(sh.getRange(row, 2).getValue() || "");
        if (!dni) return "";
        return getStudentNameByDni(dni);
    });
}

/** Migra participation al esquema con columna name (col 3). Idempotente. */
function ensureParticipationSchema(sheet) {
    ensureColumn(sheet, "name", "dni", function (row, sh) {
        var dni = String(sh.getRange(row, 2).getValue() || "");
        if (!dni) return "";
        return getStudentNameByDni(dni);
    });
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
            var date = dateToYMD(data[i][1]);
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
    var ymd = dateToYMD(data.date);
    var row = findAttendanceRow(sheet, data.subject, ymd);

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
        // Crear nueva fila — forzar la columna de fecha como texto para evitar
        // que Sheets la parsee como Date y la convierta segun su timezone.
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 2).setNumberFormat("@");
        sheet.getRange(newRow, 1, 1, 3).setValues([[data.subject, ymd, String(data.dni)]]);
    }
    return { ok: true };
}

/** Quita UN dni de una fecha. data = { subject, date, dni } */
function removeAttendance(data) {
    if (!data || !data.subject || !data.date || !data.dni) {
        return { ok: false, error: "Faltan campos: subject, date, dni" };
    }
    var sheet = getOrCreateSheet("attendance", ["subject", "date", "dnis"]);
    var ymd = dateToYMD(data.date);
    var row = findAttendanceRow(sheet, data.subject, ymd);
    if (row === -1) {
        return { ok: false, error: "Fecha no encontrada" };
    }
    var current = String(sheet.getRange(row, 3).getValue() || "");
    var list = current ? current.split(",") : [];
    var dni = String(data.dni);
    var next = [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
        var v = list[i].trim();
        if (!v) continue;
        if (v === dni) { found = true; continue; }
        next.push(v);
    }
    if (!found) {
        return { ok: false, error: "DNI no registrado en esta fecha" };
    }
    sheet.getRange(row, 3).setValue(next.join(","));
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
            var ymd = dateToYMD(date);
            var dnis = attendance[subj][date];
            // Normalizar: puede venir como array o string
            var dnisStr = Array.isArray(dnis) ? dnis.join(",") : String(dnis);
            var row = findAttendanceRow(sheet, subj, ymd);

            if (row !== -1) {
                // Merge: agregar DNIs nuevos a los existentes
                var current = String(sheet.getRange(row, 3).getValue() || "");
                var merged = mergeCSV(current, dnisStr);
                sheet.getRange(row, 3).setValue(merged);
            } else {
                var newRow = sheet.getLastRow() + 1;
                sheet.getRange(newRow, 2).setNumberFormat("@");
                sheet.getRange(newRow, 1, 1, 3).setValues([[subj, ymd, dnisStr]]);
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
    var sheet = getOrCreateSheet("grades", ["subject", "dni", "name", "field", "value"]);
    ensureGradesSchema(sheet);
    var data = sheet.getDataRange().getValues();
    var grades = {};
    for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
            var subj = String(data[i][0]);
            var dni = String(data[i][1]);
            // col 3 = name (no se expone en el payload, es solo visual)
            var field = data[i][3];
            var value = data[i][4];
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
    var sheet = getOrCreateSheet("grades", ["subject", "dni", "name", "field", "value"]);
    ensureGradesSchema(sheet);
    var row = findRow3(sheet, 1, data.subject, 2, data.dni, 4, data.field);

    var val = (data.value !== null && data.value !== undefined && data.value !== "") ? Number(data.value) : "";
    var name = data.name || getStudentNameByDni(data.dni);

    if (row !== -1) {
        sheet.getRange(row, 5).setValue(val);
        // Refrescar el nombre por si el alumno fue renombrado
        if (name) sheet.getRange(row, 3).setValue(name);
    } else {
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 1, 1, 5).setValues([[data.subject, data.dni, name, data.field, val]]);
    }
    return { ok: true };
}

/** Bulk save compatible con v1 — upsert por fila, no borra. */
function saveGradesBulk(grades) {
    if (!grades || typeof grades !== "object") {
        return { ok: false, error: "Se esperaba un objeto" };
    }
    var sheet = getOrCreateSheet("grades", ["subject", "dni", "name", "field", "value"]);
    ensureGradesSchema(sheet);
    var subjects = Object.keys(grades);

    for (var i = 0; i < subjects.length; i++) {
        var subj = subjects[i];
        var dnis = Object.keys(grades[subj]);
        for (var j = 0; j < dnis.length; j++) {
            var dni = dnis[j];
            var name = getStudentNameByDni(dni);
            var fields = Object.keys(grades[subj][dni]);
            for (var k = 0; k < fields.length; k++) {
                var field = fields[k];
                var val = grades[subj][dni][field];
                val = (val !== null && val !== undefined && val !== "") ? Number(val) : "";

                var row = findRow3(sheet, 1, subj, 2, dni, 4, field);
                if (row !== -1) {
                    sheet.getRange(row, 5).setValue(val);
                    if (name) sheet.getRange(row, 3).setValue(name);
                } else {
                    var newRow = sheet.getLastRow() + 1;
                    sheet.getRange(newRow, 1, 1, 5).setValues([[subj, dni, name, field, val]]);
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

// ===================== PARTICIPATION =====================

/** Lee todos los contadores. Devuelve { subject: { dni: count } }. */
function getParticipation() {
    var sheet = getOrCreateSheet("participation", ["subject", "dni", "name", "count"]);
    ensureParticipationSchema(sheet);
    var data = sheet.getDataRange().getValues();
    var out = {};
    for (var i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        var subj = String(data[i][0]);
        var dni = String(data[i][1]);
        // col 3 = name (solo visual)
        var count = Number(data[i][3] || 0);
        if (!out[subj]) out[subj] = {};
        out[subj][dni] = count;
    }
    return { ok: true, data: out };
}

/** Incrementa contador de participacion. data = { subject, dni, delta } */
function incrementParticipation(data) {
    if (!data || !data.subject || !data.dni) {
        return { ok: false, error: "Faltan campos: subject, dni" };
    }
    var delta = Number(data.delta);
    if (!isFinite(delta) || delta === 0) {
        return { ok: false, error: "delta invalido" };
    }
    var sheet = getOrCreateSheet("participation", ["subject", "dni", "name", "count"]);
    ensureParticipationSchema(sheet);
    var row = findRow2(sheet, 1, data.subject, 2, data.dni);
    var name = data.name || getStudentNameByDni(data.dni);

    if (row !== -1) {
        var current = Number(sheet.getRange(row, 4).getValue() || 0);
        var next = Math.max(0, current + delta);
        sheet.getRange(row, 4).setValue(next);
        if (name) sheet.getRange(row, 3).setValue(name);
        return { ok: true, data: { count: next } };
    }
    // Nueva fila. No permitir valores negativos.
    var initial = Math.max(0, delta);
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 4).setValues([[data.subject, String(data.dni), name, initial]]);
    return { ok: true, data: { count: initial } };
}

/** Fija el contador a un valor exacto. data = { subject, dni, count } */
function setParticipation(data) {
    if (!data || !data.subject || !data.dni) {
        return { ok: false, error: "Faltan campos: subject, dni" };
    }
    var count = Math.max(0, Number(data.count) || 0);
    var sheet = getOrCreateSheet("participation", ["subject", "dni", "name", "count"]);
    ensureParticipationSchema(sheet);
    var row = findRow2(sheet, 1, data.subject, 2, data.dni);
    var name = data.name || getStudentNameByDni(data.dni);
    if (row !== -1) {
        sheet.getRange(row, 4).setValue(count);
        if (name) sheet.getRange(row, 3).setValue(name);
    } else {
        var newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, 1, 1, 4).setValues([[data.subject, String(data.dni), name, count]]);
    }
    return { ok: true, data: { count: count } };
}

// ===================== REPAIR UTILITIES =====================
//
// Funciones para correr MANUALMENTE desde el editor de Apps Script
// (Run → seleccionar la funcion → Run). Reordenan los datos de grades y
// participation al esquema correcto, detectando por el contenido cual columna
// es cual — util si una migracion previa o una escritura con indices viejos
// dejo la hoja desordenada (por ej. el numero en la columna field).

/** Devuelve true si el valor parece un numero (incluye strings numericos). */
function isNumericLike(v) {
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "number") return isFinite(v);
    var n = Number(v);
    return isFinite(n) && String(v).trim() !== "";
}

/**
 * Repara la hoja grades: reordena cada fila a [subject, dni, name, field, value].
 * Detecta por contenido: dni/value son numericos, field es string no-numerico,
 * name se completa desde students.
 * Correr manualmente desde el editor de Apps Script.
 */
function repairGradesSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("grades");
    if (!sheet) { Logger.log("Hoja 'grades' no existe"); return; }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) { Logger.log("Hoja vacia, nada que reparar"); return; }

    var all = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var rebuilt = [["subject", "dni", "name", "field", "value"]];
    var fixed = 0, skipped = 0;

    for (var i = 1; i < all.length; i++) {
        var cells = all[i].slice();
        // Ignorar filas vacias
        var hasSomething = cells.some(function (v) { return v !== "" && v !== null; });
        if (!hasSomething) continue;

        // Detectar subject: primer string no-numerico corto que no sea header
        var subject = "", dni = "", fieldName = "", valueNum = "";
        var stringCells = [];
        var numericCells = [];
        for (var c = 0; c < cells.length; c++) {
            var v = cells[c];
            if (v === "" || v === null) continue;
            if (isNumericLike(v)) numericCells.push({ idx: c, v: v });
            else stringCells.push({ idx: c, v: String(v) });
        }

        // Heuristica:
        //  - subject: string (ej. "ppii", "programacion"). Suele estar en col 0.
        //  - dni: numerico de 7-8 digitos.
        //  - field: string que NO sea el subject.
        //  - value: numerico que NO sea el dni.
        //  - name: string con espacio o largo, NO igual al subject ni al field.

        // Elegir dni: numero con 7-8 digitos
        var dniCell = null;
        for (var n = 0; n < numericCells.length; n++) {
            var s = String(numericCells[n].v).replace(/\D/g, "");
            if (s.length >= 7 && s.length <= 9) { dniCell = numericCells[n]; break; }
        }
        // Elegir value: el otro numero
        var valueCell = null;
        for (var n2 = 0; n2 < numericCells.length; n2++) {
            if (dniCell && numericCells[n2].idx === dniCell.idx) continue;
            valueCell = numericCells[n2]; break;
        }

        // subject: preferir string en col 0, si no el mas corto y sin espacios
        var subjectCell = null;
        if (stringCells.length > 0) {
            subjectCell = stringCells[0];
            for (var s1 = 0; s1 < stringCells.length; s1++) {
                if (stringCells[s1].idx === 0) { subjectCell = stringCells[s1]; break; }
            }
        }

        // field: string que no sea el subject y no parezca nombre (no tiene espacios)
        var fieldCell = null;
        for (var s2 = 0; s2 < stringCells.length; s2++) {
            if (subjectCell && stringCells[s2].idx === subjectCell.idx) continue;
            var txt = stringCells[s2].v;
            if (txt.indexOf(" ") === -1 || /^(TP\d+|Parcial|Participacion|P\d)/i.test(txt)) {
                fieldCell = stringCells[s2]; break;
            }
        }
        // fallback: tomar el segundo string
        if (!fieldCell) {
            for (var s3 = 0; s3 < stringCells.length; s3++) {
                if (subjectCell && stringCells[s3].idx === subjectCell.idx) continue;
                fieldCell = stringCells[s3]; break;
            }
        }

        if (!dniCell || !subjectCell || !fieldCell) {
            Logger.log("Fila " + (i + 1) + " no reparable: " + JSON.stringify(cells));
            skipped++;
            continue;
        }

        subject = String(subjectCell.v);
        dni = String(dniCell.v);
        fieldName = String(fieldCell.v);
        valueNum = valueCell ? Number(valueCell.v) : "";
        var name = getStudentNameByDni(dni);

        rebuilt.push([subject, dni, name, fieldName, valueNum]);
        fixed++;
    }

    // Reescribir la hoja entera
    sheet.clear();
    sheet.getRange(1, 1, rebuilt.length, 5).setValues(rebuilt);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    Logger.log("Reparadas " + fixed + " filas. Saltadas " + skipped + ".");
}

/**
 * Repara la hoja participation: reordena cada fila a [subject, dni, name, count].
 * Correr manualmente desde el editor de Apps Script.
 */
function repairParticipationSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("participation");
    if (!sheet) { Logger.log("Hoja 'participation' no existe"); return; }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) { Logger.log("Hoja vacia, nada que reparar"); return; }

    var all = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var rebuilt = [["subject", "dni", "name", "count"]];
    var fixed = 0;

    for (var i = 1; i < all.length; i++) {
        var cells = all[i];
        var hasSomething = cells.some(function (v) { return v !== "" && v !== null; });
        if (!hasSomething) continue;

        var subject = "", dni = "", count = 0;
        var numerics = [];
        var strings = [];
        for (var c = 0; c < cells.length; c++) {
            var v = cells[c];
            if (v === "" || v === null) continue;
            if (isNumericLike(v)) numerics.push(v);
            else strings.push(String(v));
        }

        // DNI: numero con 7-8 digitos. count: el otro numero (o 0).
        for (var n = 0; n < numerics.length; n++) {
            var s = String(numerics[n]).replace(/\D/g, "");
            if (s.length >= 7 && s.length <= 9 && !dni) dni = String(numerics[n]);
            else count = Number(numerics[n]);
        }
        subject = strings.length > 0 ? strings[0] : "";

        if (!subject || !dni) { continue; }
        var name = getStudentNameByDni(dni);
        rebuilt.push([subject, dni, name, count]);
        fixed++;
    }

    sheet.clear();
    sheet.getRange(1, 1, rebuilt.length, 4).setValues(rebuilt);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    Logger.log("Reparadas " + fixed + " filas de participation.");
}
