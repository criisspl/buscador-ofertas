// Comprobaciones de lo que el navegador manda a /api/ia. Solo se reenvía texto: el modelo
// y los parámetros los pone el servidor, nunca el cliente.

export const MAX_BYTES = 200 * 1024;
const MAX_TEXTO = 40_000;
const MAX_MENSAJES = 3;

export interface Mensaje {
  role: "system" | "user";
  content: string;
}

/** Lo que manda el navegador, ya validado por valida(). */
export interface Entrada {
  messages: Mensaje[];
  json?: boolean;
}

/** Devuelve el motivo del rechazo, o null si la entrada es válida. */
export function valida(e: unknown): string | null {
  if (!e || typeof e !== "object" || !Array.isArray((e as Entrada).messages))
    return "Faltan los mensajes.";
  const { messages } = e as { messages: unknown[] };
  if (messages.length < 1 || messages.length > MAX_MENSAJES) return "Número de mensajes no válido.";
  let texto = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object") return "Mensaje no válido.";
    const { role, content } = m as Partial<Mensaje>;
    if (role !== "system" && role !== "user") return "Mensaje no válido.";
    if (typeof content !== "string") return "Mensaje no válido.";
    texto += content.length;
  }
  if (texto > MAX_TEXTO) return "Texto demasiado largo.";
  const { json } = e as { json?: unknown };
  if (json !== undefined && typeof json !== "boolean") return "Opción no válida.";
  return null;
}
