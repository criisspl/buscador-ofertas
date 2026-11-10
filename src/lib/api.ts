import { ipDe, limitador } from "@/lib/limite";

/** Respuesta JSON que nunca se guarda en caché. */
export const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "cache-control": "no-store" } });

/** Solo desde la propia web. Un `Origin` inválido o `null` (iframes, ficheros locales) se rechaza. */
export function mismoOrigen(request: Request): boolean {
  const origen = request.headers.get("origin");
  if (!origen) return true;
  try {
    return new URL(origen).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

interface OpcionesLimite {
  prefijo: string;
  peticiones: number;
  /** Mensaje si el servidor no tiene Upstash en producción. */
  mensajeConfig: string;
  mensajeLimite?: string;
}

/** Aplica el límite por IP. Devuelve la respuesta de error, o null si la petición puede seguir. */
export async function aplicaLimite(
  request: Request,
  { prefijo, peticiones, mensajeConfig, mensajeLimite }: OpcionesLimite,
): Promise<Response | null> {
  const limite = limitador(prefijo, peticiones);
  if (!limite) {
    return process.env.NODE_ENV === "production"
      ? json({ error: "config", mensaje: mensajeConfig }, 503)
      : null;
  }
  const { success } = await limite.limit(ipDe(request));
  if (success) return null;
  return json(
    { error: "limite", mensaje: mensajeLimite ?? "Vas muy rápido: espera un minuto." },
    429,
  );
}
