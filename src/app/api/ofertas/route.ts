import { aplicaLimite, json, mismoOrigen } from "@/lib/api";
import { buscar } from "@/lib/ofertas/fuentes";

export async function GET(request: Request) {
  if (!mismoOrigen(request)) return json({ error: "origen" }, 403);

  const rechazo = await aplicaLimite(request, {
    prefijo: "ofertas",
    peticiones: 20,
    mensajeConfig: "La búsqueda no está configurada todavía.",
  });
  if (rechazo) return rechazo;

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
