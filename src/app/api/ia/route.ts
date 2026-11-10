import { aplicaLimite, json, mismoOrigen } from "@/lib/api";
import { limitador } from "@/lib/limite";
import { llamarProveedores, type Proveedor } from "@/lib/ia/servidor";
import { MAX_BYTES, valida } from "@/lib/ia/valida";

// Tope global de peticiones a la IA al día, sumando a todas las personas, para no agotar los
// cupos gratuitos de Groq y Mistral. 500 deja unas 60 sesiones de 8 consultas al día; súbelo si
// los proveedores lo aguantan.
const TOPE_DIARIO = 500;

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
  if (!mismoOrigen(request)) return json({ error: "origen" }, 403);

  const rechazo = await aplicaLimite(request, {
    prefijo: "ia",
    peticiones: 8,
    mensajeConfig: MENSAJES.config.mensaje,
    mensajeLimite: "Vas muy rápido: espera un minuto y vuelve a intentarlo.",
  });
  if (rechazo) return rechazo;

  let cuerpo: unknown;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BYTES)
      return json({ error: "grande", mensaje: "El texto pesa demasiado." }, 413);
    cuerpo = JSON.parse(texto);
  } catch {
    return json({ error: "formato", mensaje: "Petición no válida." }, 400);
  }
  const v = valida(cuerpo);
  if (!v.ok) return json({ error: "formato", mensaje: v.fallo }, 400);

  // Tope global: se cuenta solo lo que llegaría a los proveedores.
  const global = limitador("ia-dia", TOPE_DIARIO, "1 d");
  if (global && !(await global.limit("global")).success) return json(MENSAJES.cupo, STATUS.cupo);

  const r = await llamarProveedores(v.entrada, proveedores());
  if (!r.ok) return json(MENSAJES[r.error], STATUS[r.error]);
  return new Response(r.cuerpo, {
    status: r.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
