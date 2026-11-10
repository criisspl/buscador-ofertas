import { Redis } from "@upstash/redis";
import { aplicaLimite, json, mismoOrigen } from "@/lib/api";
import { borrar, escribir, leer, MAX_BLOB, type Almacen, type Registro } from "@/lib/nube/servidor";

const respuesta = (status: number, cuerpo: unknown) => json(cuerpo, status);

function almacen(): Almacen | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    get: (k) => redis.get<Registro>(k),
    set: async (k, v, ex) => void (await redis.set(k, v, { ex })),
    del: async (k) => void (await redis.del(k)),
  };
}

/** Comprobaciones comunes: origen, configuración y límite por IP. Devuelve el almacén o una respuesta de error. */
async function entrada(request: Request): Promise<Almacen | Response> {
  if (!mismoOrigen(request)) return respuesta(403, { error: "origen" });
  const a = almacen();
  if (!a)
    return respuesta(503, {
      error: "config",
      mensaje: "La copia en la nube no está configurada todavía.",
    });
  const rechazo = await aplicaLimite(request, {
    prefijo: "copia",
    peticiones: 10,
    mensajeConfig: "La copia en la nube no está configurada todavía.",
  });
  return rechazo ?? a;
}

async function conCuerpo(
  request: Request,
  f: (a: Almacen, cuerpo: unknown) => Promise<{ status: number; cuerpo: unknown }>,
) {
  const a = await entrada(request);
  if (a instanceof Response) return a;
  let cuerpo: unknown;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BLOB + 1000)
      return respuesta(413, {
        error: "grande",
        mensaje: "La copia pesa demasiado para guardarla.",
      });
    cuerpo = JSON.parse(texto);
  } catch {
    return respuesta(400, { error: "formato", mensaje: "Petición no válida." });
  }
  const r = await f(a, cuerpo);
  return respuesta(r.status, r.cuerpo);
}

export async function GET(request: Request) {
  const a = await entrada(request);
  if (a instanceof Response) return a;
  const r = await leer(a, new URL(request.url).searchParams.get("id"));
  return respuesta(r.status, r.cuerpo);
}

export const PUT = (request: Request) => conCuerpo(request, escribir);
export const DELETE = (request: Request) => conCuerpo(request, borrar);
