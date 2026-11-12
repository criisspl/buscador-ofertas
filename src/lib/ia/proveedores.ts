import type { Ajustes } from "../tipos.ts";
import { respuestaDemo } from "./demo.ts";
import { ErrorIa, type Pregunta, type ProveedorIa } from "./tipos.ts";
import type { Mensaje } from "./valida.ts";

const POR_ESTADO: Record<number, ErrorIa["codigo"]> = {
  400: "formato",
  401: "clave",
  403: "clave",
  429: "cupo",
  503: "config",
};

async function enviar(
  url: string,
  cuerpo: unknown,
  clave: string | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(clave ? { authorization: `Bearer ${clave}` } : {}),
      },
      body: JSON.stringify(cuerpo),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorIa(
      "caida",
      "No hay conexión con la IA. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
}

function mensajes(p: Pregunta): Mensaje[] {
  return [
    ...(p.sistema ? [{ role: "system" as const, content: p.sistema }] : []),
    { role: "user", content: p.texto },
  ];
}

/** Hace la llamada y saca el texto de la respuesta, con los mismos errores para todos los modos. */
async function consultar(
  url: string,
  clave: string | undefined,
  cuerpo: (conJson: boolean) => unknown,
  p: Pregunta,
  reintentaSinJson: boolean,
): Promise<string> {
  let r = await enviar(url, cuerpo(!!p.json), clave, p.signal);
  // Algunos modelos no admiten el modo JSON: se reintenta sin él.
  if (reintentaSinJson && p.json && r.status === 400)
    r = await enviar(url, cuerpo(false), clave, p.signal);

  if (!r.ok) {
    const datos = await r.json().catch(() => null);
    const codigo = POR_ESTADO[r.status] ?? "caida";
    throw new ErrorIa(
      codigo,
      datos?.mensaje ?? (codigo === "clave" ? "Tu clave no es válida." : "La IA no ha respondido."),
    );
  }
  const datos = await r.json().catch(() => null);
  const texto = datos?.choices?.[0]?.message?.content;
  if (typeof texto !== "string")
    throw new ErrorIa("formato", "La IA ha respondido algo inesperado.");
  return texto;
}

/** La IA de la app: el texto pasa por `/api/ia`, que pone el modelo y los límites. */
export class ProveedorApp implements ProveedorIa {
  readonly modo = "app" as const;

  async preguntar(p: Pregunta) {
    const messages = mensajes(p);
    return consultar(
      "/api/ia",
      undefined,
      (conJson) => ({ messages, ...(conJson ? { json: true } : {}) }),
      p,
      false,
    );
  }
}

/** La IA de la persona: llamada directa a su proveedor (compatible con OpenAI) con su clave. */
export class ProveedorPropio implements ProveedorIa {
  readonly modo = "propia" as const;

  constructor(private readonly ajustes: Pick<Ajustes, "url" | "modelo" | "clave">) {}

  async preguntar(p: Pregunta) {
    const { url, modelo, clave } = this.ajustes;
    if (!url || !modelo || !clave)
      throw new ErrorIa("config", "Faltan datos de tu IA: dirección, modelo y clave.");
    const messages = mensajes(p);
    return consultar(
      url,
      clave,
      (conJson) => ({
        model: modelo,
        messages,
        temperature: 0.3,
        ...(conJson ? { response_format: { type: "json_object" } } : {}),
      }),
      p,
      true,
    );
  }
}

/** Respuestas de ejemplo, sin red ni IA. */
export class ProveedorDemo implements ProveedorIa {
  readonly modo = "demo" as const;

  async preguntar(p: Pregunta) {
    return respuestaDemo(p);
  }
}

/** El proveedor que corresponde a los ajustes de la persona. */
export function proveedorDe(ajustes: Ajustes): ProveedorIa {
  switch (ajustes.modoIa) {
    case "demo":
      return new ProveedorDemo();
    case "propia":
      return new ProveedorPropio(ajustes);
    default:
      return new ProveedorApp();
  }
}
