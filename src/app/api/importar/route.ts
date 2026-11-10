import { aplicaLimite, json, mismoOrigen } from "@/lib/api";
import { descargarHtml, ErrorDescarga } from "@/lib/importar/red";
import { ErrorExtraccion, extraerOferta } from "@/lib/importar/extrae";

const MAX_BYTES = 8 * 1024;

export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: "origen" }, 403);

  const rechazo = await aplicaLimite(request, {
    prefijo: "importar",
    peticiones: 6,
    mensajeConfig: "La importación no está configurada todavía.",
  });
  if (rechazo) return rechazo;

  let enlace: unknown;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BYTES)
      return json({ error: "grande", mensaje: "La petición pesa demasiado." }, 413);
    enlace = JSON.parse(texto).url;
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
