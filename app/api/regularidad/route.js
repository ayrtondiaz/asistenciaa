const SHEET_ID =
  process.env.REGULARIDAD_SHEET_ID || "12nsCZyWo5HheFOkZYRv1IVgSI0oTYbJJtNEgDoomjGw";
const SHEET_NAME = process.env.REGULARIDAD_SHEET_NAME || "Regularidad";
const RANGE = "A8:L200";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const normalizeHeader = (h) =>
  h.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dni = (searchParams.get("dni") || "").replace(/\D/g, "");

  if (!/^\d{7,8}$/.test(dni)) {
    return Response.json({ ok: false, error: "El DNI debe tener 7 u 8 digitos" }, { status: 400 });
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv` +
    `&sheet=${encodeURIComponent(SHEET_NAME)}&range=${RANGE}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    const text = await res.text();
    if (!res.ok || text.trimStart().startsWith("<")) {
      return Response.json(
        { ok: false, error: "No se pudo leer la planilla de regularidad" },
        { status: 502 }
      );
    }

    const [header = [], ...rows] = parseCsv(text);
    const cols = header.map(normalizeHeader);
    const idx = (name) => cols.indexOf(name);
    const iDni = idx("dni");
    const iName = idx("apellido y nombre");
    const iStatus = idx("situacion curricular");
    const iGrade = idx("nota final");

    if (iDni < 0 || iStatus < 0) {
      return Response.json(
        { ok: false, error: "La planilla no tiene el formato esperado" },
        { status: 502 }
      );
    }

    const row = rows.find((r) => (r[iDni] || "").replace(/\D/g, "") === dni);
    if (!row) {
      return Response.json({ ok: true, data: null });
    }

    // Only this student's data leaves the server.
    return Response.json({
      ok: true,
      data: {
        name: iName >= 0 ? row[iName] : "",
        status: row[iStatus] || "",
        grade: iGrade >= 0 ? row[iGrade] : "",
      },
    });
  } catch (err) {
    console.error("Regularidad fetch error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
