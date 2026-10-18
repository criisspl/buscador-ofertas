import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Límite por persona. Sin Upstash configurado devuelve null (solo se permite en desarrollo). */
export function limitador(prefix: string, peticiones: number): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(peticiones, "1 m"),
    prefix,
  });
}

export function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}
