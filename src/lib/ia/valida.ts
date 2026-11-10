import { z } from "zod";

// Comprobaciones de lo que el navegador manda a /api/ia. Solo se reenvía texto: el modelo
// y los parámetros los pone el servidor, nunca el cliente.

export const MAX_BYTES = 200 * 1024;
const MAX_TEXTO = 40_000;
const MAX_MENSAJES = 3;

const Mensaje = z.strictObject(
  {
    role: z.enum(["system", "user"], { error: "Mensaje no válido." }),
    content: z.string({ error: "Mensaje no válido." }),
  },
  { error: "Mensaje no válido." },
);

const Entrada = z
  .strictObject(
    {
      messages: z
        .array(Mensaje, { error: "Faltan los mensajes." })
        .min(1, { error: "Número de mensajes no válido." })
        .max(MAX_MENSAJES, { error: "Número de mensajes no válido." }),
      json: z.boolean({ error: "Opción no válida." }).optional(),
    },
    { error: "Faltan los mensajes." },
  )
  .refine((e) => e.messages.reduce((n, m) => n + m.content.length, 0) <= MAX_TEXTO, {
    error: "Texto demasiado largo.",
  });

/** Lo que manda el navegador, ya validado por valida(). */
export type Entrada = z.infer<typeof Entrada>;
export type Mensaje = z.infer<typeof Mensaje>;

/** Valida la entrada: devuelve los datos limpios o el motivo del rechazo. */
export function valida(e: unknown): { ok: true; entrada: Entrada } | { ok: false; fallo: string } {
  const r = Entrada.safeParse(e);
  if (r.success) return { ok: true, entrada: r.data };
  return { ok: false, fallo: r.error.issues[0]?.message ?? "Petición no válida." };
}
