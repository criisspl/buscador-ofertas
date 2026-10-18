import { ipDe, limitador } from "@/lib/limite";
import { descargarHtml, ErrorDescarga } from "@/lib/importar/red";
import { ErrorExtraccion, extraerOferta } from "@/lib/importar/extrae";

const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(request.url).host)
    return json({ error: "origen" }, 403);

  const limite = limitador("importar", 6);
  if (limite) {
    if (!(await limite.limit(ipDe(request))).success)
      return json({ error: "limite", mensaje: "Vas muy rápido: espera un minuto." }, 429);
  } else if (process.env.NODE_ENV === "production") {
    return json({ error: "config", mensaje: "La importación no está configurada todavía." }, 503);
  }

  let enlace: unknown;
  try {
    enlace = (await request.json()).url;
  } catch {
    return json({ error: "formato", mensaje: "Petición no válida." }, 400);
  }
  if (typeof enlace !== "string" || enlace.length > 2000)
    return json({ error: "formato", mensaje: "Falta el enlace de la oferta." }, 400);

  try {
    const { url, html } = await descargarHtml(enlace);
    return json({ oferta: extraerOferta(html, url) });
  } catch (e) {
    if (e instanceof ErrorDescarga || e instanceof ErrorExtraccion)
      return json({ error: "importar", mensaje: e.message }, 422);
    return json({ error: "caida", mensaje: "No se ha podido importar la oferta." }, 502);
  }
}
