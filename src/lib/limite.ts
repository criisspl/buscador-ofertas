import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Ventana = Parameters<typeof Ratelimit.slidingWindow>[1];

const cache = new Map<string, Ratelimit>();

/**
 * Límite por persona (o global, según quién lo use). Se crea una vez por prefijo y configuración
 * y se reutiliza entre peticiones. Sin Upstash configurado devuelve null (solo se permite en desarrollo).
 */
export function limitador(
  prefix: string,
  peticiones: number,
  ventana: Ventana = "1 m",
): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  if (!url || !token) return null;
  const clave = [prefix, peticiones, ventana, url, token].join("|");
  let l = cache.get(clave);
  if (!l) {
    l = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(peticiones, ventana),
      prefix,
    });
    cache.set(clave, l);
  }
  return l;
}

export function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}
