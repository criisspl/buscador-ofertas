import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { llamarProveedores, type Proveedor } from "@/lib/ia/servidor";
import { MAX_BYTES, valida, type Entrada } from "@/lib/ia/valida";

const json = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "cache-control": "no-store" } });

const MENSAJES = {
  config: { error: "config", mensaje: "La IA de esta web no está configurada todavía." },
  cupo: {
    error: "cupo",
    mensaje:
      "Hoy hay mucha gente usando la IA y se ha llenado el cupo gratuito. Prueba más tarde o usa tu propia clave.",
  },
  caida: { error: "caida", mensaje: "La IA no responde ahora mismo. Prueba en un rato." },
} as const;
const STATUS = { config: 503, cupo: 429, caida: 502 } as const;

/** Límite por persona. Sin Upstash configurado, solo se permite en desarrollo. */
function limitador(): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(8, "1 m"),
    prefix: "ia",
  });
}

function proveedores(): Proveedor[] {
  const { GROQ_API_KEY, GROQ_MODEL, MISTRAL_API_KEY, MISTRAL_MODEL } = process.env;
  const lista: Proveedor[] = [];
  if (GROQ_API_KEY)
    lista.push({
      nombre: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      modelo: GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      clave: GROQ_API_KEY,
    });
  if (MISTRAL_API_KEY)
    lista.push({
      nombre: "Mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      modelo: MISTRAL_MODEL || "mistral-small-latest",
      clave: MISTRAL_API_KEY,
    });
  return lista;
}

export async function POST(request: Request) {
  // Solo desde la propia web: evita que otras páginas gasten tu cupo.
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(request.url).host)
    return json({ error: "origen" }, 403);

  const limite = limitador();
  if (limite) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const { success } = await limite.limit(ip);
    if (!success)
      return json(
        { error: "limite", mensaje: "Vas muy rápido: espera un minuto y vuelve a intentarlo." },
        429,
      );
  } else if (process.env.NODE_ENV === "production") {
    return json(MENSAJES.config, STATUS.config);
  }

  let entrada: Entrada;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BYTES)
      return json({ error: "grande", mensaje: "El texto pesa demasiado." }, 413);
    entrada = JSON.parse(texto);
  } catch {
    return json({ error: "formato", mensaje: "Petición no válida." }, 400);
  }
  const fallo = valida(entrada);
  if (fallo) return json({ error: "formato", mensaje: fallo }, 400);

  const r = await llamarProveedores(entrada, proveedores());
  if (!r.ok) return json(MENSAJES[r.error], STATUS[r.error]);
  return new Response(r.cuerpo, {
    status: r.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
