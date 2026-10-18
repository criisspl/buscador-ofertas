import { ipDe, limitador } from "@/lib/limite";
import { buscar } from "@/lib/ofertas/fuentes";

const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(request.url).host)
    return json({ error: "origen" }, 403);

  const limite = limitador("ofertas", 20);
  if (limite) {
    const { success } = await limite.limit(ipDe(request));
    if (!success)
      return json({ error: "limite", mensaje: "Vas muy rápido: espera un minuto." }, 429);
  } else if (process.env.NODE_ENV === "production") {
    return json({ error: "config", mensaje: "La búsqueda no está configurada todavía." }, 503);
  }

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  if (!q) return json({ error: "formato", mensaje: "Falta qué puesto buscar." }, 400);

  const r = await buscar(
    {
      q,
      ubicacion: (p.get("ubicacion") ?? "").trim().slice(0, 100),
      remoto: p.get("remoto") === "1",
    },
    {
      adzunaId: process.env.ADZUNA_APP_ID,
      adzunaClave: process.env.ADZUNA_APP_KEY,
      adzunaPais: process.env.ADZUNA_PAIS,
      joobleClave: process.env.JOOBLE_API_KEY,
    },
  );
  if (r.fuentes === 0)
    return json({ error: "config", mensaje: "No hay ninguna fuente de ofertas disponible." }, 503);
  if (r.ofertas.length === 0 && r.fallos.length === r.fuentes)
    return json({ error: "caida", mensaje: "Las fuentes no responden ahora mismo." }, 502);
  return json({ ofertas: r.ofertas, fallos: r.fallos });
}
