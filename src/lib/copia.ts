import { z } from "zod";
import {
  CandidaturaSchema,
  EncajeSchema,
  OfertaSchema,
  PerfilSchema,
  PreferenciasSchema,
} from "./esquemas.ts";
import type { Almacenamiento } from "./almacen/tipos.ts";

// Copia completa de los datos. Los ajustes (con tu clave de IA) se quedan fuera a propósito.
const Copia = z.object({
  version: z.literal(1),
  perfil: PerfilSchema.optional(),
  preferencias: PreferenciasSchema.optional(),
  ofertas: z.array(OfertaSchema),
  encajes: z.array(EncajeSchema),
  candidaturas: z.array(CandidaturaSchema),
});

export async function instantanea(almacen: Almacenamiento): Promise<string> {
  const { perfil, preferencias, ofertas, encajes, candidaturas } = await almacen.leerDatos();
  return JSON.stringify({ version: 1, perfil, preferencias, ofertas, encajes, candidaturas });
}

export async function restaurar(almacen: Almacenamiento, texto: string): Promise<void> {
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
  const c = r.data;
  await almacen.escribirLote(c);
}
