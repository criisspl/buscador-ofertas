import { z } from "zod";
import {
  CandidaturaSchema,
  EncajeSchema,
  OfertaSchema,
  PerfilSchema,
  PreferenciasSchema,
} from "./esquemas.ts";
import type { Almacenamiento, Datos } from "./almacen/tipos.ts";

// Copia completa de los datos. Los ajustes (con tu clave de IA) se quedan fuera a propósito.
const Copia = z.object({
  version: z.literal(1),
  perfil: PerfilSchema.optional(),
  preferencias: PreferenciasSchema.optional(),
  ofertas: z.array(OfertaSchema),
  encajes: z.array(EncajeSchema),
  candidaturas: z.array(CandidaturaSchema),
});

/** Tamaño máximo de una copia al leerla (en caracteres): más que de sobra para datos personales. */
export const MAX_COPIA = 25_000_000;

export function serializar({
  perfil,
  preferencias,
  ofertas,
  encajes,
  candidaturas,
}: Datos): string {
  return JSON.stringify({ version: 1, perfil, preferencias, ofertas, encajes, candidaturas });
}

export async function instantanea(almacen: Almacenamiento): Promise<string> {
  return serializar(await almacen.leerDatos());
}

/** Valida y limpia una copia (formato, versión, tamaño): lo desconocido se descarta. */
export function leerCopia(texto: string): Datos {
  if (texto.length > MAX_COPIA) throw new Error("La copia es demasiado grande.");
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error("La copia no es un JSON válido.");
  }
  const r = Copia.safeParse(json);
  if (!r.success) {
    const fallo = r.error.issues[0];
    const donde = fallo?.path.join(".") || "raíz";
    throw new Error(`La copia no tiene el formato esperado (${donde}: ${fallo?.message}).`);
  }
  const { perfil, preferencias, ofertas, encajes, candidaturas } = r.data;
  return { perfil, preferencias, ofertas, encajes, candidaturas };
}

export async function restaurar(almacen: Almacenamiento, texto: string): Promise<void> {
  await almacen.escribirLote(leerCopia(texto));
}
