import type { Entrada } from "./valida.ts";

export interface Proveedor {
  nombre: string;
  url: string;
  modelo: string;
  clave: string;
}

export type Resultado =
  { ok: true; status: number; cuerpo: string } | { ok: false; error: "config" | "cupo" | "caida" };

/** Cuerpo en formato OpenAI: el modelo y los límites los decide el servidor. */
export function cuerpoPara(e: Entrada, modelo: string) {
  return {
    model: modelo,
    messages: e.messages,
    temperature: 0.3,
    max_tokens: 4096,
    ...(e.json ? { response_format: { type: "json_object" } } : {}),
  };
}

/**
 * Prueba los proveedores por orden. Pasa al siguiente si uno está saturado (429),
 * caído (5xx), rechaza la clave (401/403) o no responde.
 */
export async function llamarProveedores(
  entrada: Entrada,
  proveedores: Proveedor[],
  peticion: typeof fetch = fetch,
): Promise<Resultado> {
  if (!proveedores.length) return { ok: false, error: "config" };
  let saturado = false;
  for (const p of proveedores) {
    let r: Response;
    try {
      r = await peticion(p.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${p.clave}` },
        body: JSON.stringify(cuerpoPara(entrada, p.modelo)),
      });
    } catch {
      continue;
    }
    if (r.status === 429) {
      saturado = true;
      continue;
    }
    if (r.status >= 500) continue;
    if (r.status === 401 || r.status === 403) {
      console.error(`IA: clave rechazada por ${p.nombre}`);
      continue;
    }
    return { ok: true, status: r.status, cuerpo: await r.text() };
  }
  return { ok: false, error: saturado ? "cupo" : "caida" };
}
