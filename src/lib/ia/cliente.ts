import type { Ajustes } from "../tipos.ts";
import type { Mensaje } from "./valida.ts";

export interface Pregunta {
  sistema?: string;
  texto: string;
  /** Pide la respuesta como un objeto JSON. */
  json?: boolean;
  signal?: AbortSignal;
}

export class ErrorIa extends Error {
  constructor(
    readonly codigo: "cupo" | "limite" | "clave" | "caida" | "formato" | "config",
    mensaje: string,
  ) {
    super(mensaje);
  }
}

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

/** Pregunta a la IA de la app (por /api/ia) o a la del usuario, según sus ajustes. */
export async function preguntar(ajustes: Ajustes, p: Pregunta): Promise<string> {
  const messages: Mensaje[] = [
    ...(p.sistema ? [{ role: "system" as const, content: p.sistema }] : []),
    { role: "user", content: p.texto },
  ];
  const propia = ajustes.modoIa === "propia";
  if (propia && (!ajustes.url || !ajustes.modelo || !ajustes.clave))
    throw new ErrorIa("config", "Faltan datos de tu IA: dirección, modelo y clave.");

  const cuerpo = (conJson: boolean) =>
    propia
      ? {
          model: ajustes.modelo,
          messages,
          temperature: 0.3,
          ...(conJson ? { response_format: { type: "json_object" } } : {}),
        }
      : { messages, ...(conJson ? { json: true } : {}) };
  const url = propia ? ajustes.url! : "/api/ia";
  const clave = propia ? ajustes.clave : undefined;

  let r = await enviar(url, cuerpo(!!p.json), clave, p.signal);
  // Algunos modelos no admiten el modo JSON: se reintenta sin él.
  if (propia && p.json && r.status === 400) r = await enviar(url, cuerpo(false), clave, p.signal);

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
