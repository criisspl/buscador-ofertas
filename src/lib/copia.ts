import { z } from "zod";
import {
  CandidaturaSchema,
  EncajeSchema,
  OfertaSchema,
  PerfilSchema,
  PreferenciasSchema,
} from "./esquemas.ts";
import type { BaseDatos } from "./store.ts";

// Copia completa de los datos. Los ajustes (con tu clave de IA) se quedan fuera a propósito.
const Copia = z.object({
  version: z.literal(1),
  perfil: PerfilSchema.optional(),
  preferencias: PreferenciasSchema.optional(),
  ofertas: z.array(OfertaSchema),
  encajes: z.array(EncajeSchema),
  candidaturas: z.array(CandidaturaSchema),
});

export async function instantanea(db: BaseDatos): Promise<string> {
  return JSON.stringify({
    version: 1,
    perfil: await db.perfil.get("perfil"),
    preferencias: await db.preferencias.get("preferencias"),
    ofertas: await db.ofertas.toArray(),
    encajes: await db.encajes.toArray(),
    candidaturas: await db.candidaturas.toArray(),
  });
}

export async function restaurar(db: BaseDatos, texto: string): Promise<void> {
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
  await db.transaction(
    "rw",
    [db.perfil, db.preferencias, db.ofertas, db.encajes, db.candidaturas],
    async () => {
      if (c.perfil) await db.perfil.put(c.perfil);
      if (c.preferencias) await db.preferencias.put(c.preferencias);
      await db.ofertas.bulkPut(c.ofertas);
      await db.encajes.bulkPut(c.encajes);
      await db.candidaturas.bulkPut(c.candidaturas);
    },
  );
}
