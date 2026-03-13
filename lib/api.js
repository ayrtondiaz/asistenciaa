export async function sheetsCall(action, data) {
  const params = new URLSearchParams({ action });
  if (data !== undefined) {
    params.set("data", JSON.stringify(data));
  }
  const res = await fetch(`/api/sheets?${params.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();

  // El script devuelve { ok, data?, error? }
  if (json.ok === false) throw new Error(json.error || "Error desconocido");

  // Para los gets, devolver json.data; para los saves, devolver json
  return json.data !== undefined ? json.data : json;
}
