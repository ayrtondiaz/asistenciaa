export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const data = searchParams.get("data");

  const base = process.env.SHEETS_API_URL;
  if (!base) {
    return Response.json({ error: "SHEETS_API_URL not configured" }, { status: 500 });
  }

  const url = new URL(base);
  if (action) url.searchParams.set("action", action);
  if (data) url.searchParams.set("data", data);

  try {
    // Google Apps Script redirects (302) — fetch follows by default
    const res = await fetch(url.toString(), {
      cache: "no-store",
      redirect: "follow",
    });

    const text = await res.text();

    // GAS can return HTML on error (quota exceeded, auth issue, etc.)
    try {
      const json = JSON.parse(text);
      return Response.json(json);
    } catch {
      console.error("Sheets API non-JSON response:", text.slice(0, 500));
      return Response.json(
        { ok: false, error: "La API de Sheets devolvio una respuesta invalida" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Sheets API fetch error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
