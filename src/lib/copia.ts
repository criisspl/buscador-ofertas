import { z } from "zod";
import type { BaseDatos } from "./store.ts";

// Copia completa de los datos. Los ajustes (con tu clave de IA) se quedan fuera a propósito.
const Copia = z.object({
  version: z.literal(1),
  perfil: z.any().optional(),
  preferencias: z.any().optional(),
  ofertas: z.array(z.any()),
  encajes: z.array(z.any()),
  candidaturas: z.array(z.any()),
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
  let c;
  try {
    c = Copia.parse(JSON.parse(texto));
  } catch {
    throw new Error("La copia no tiene el formato esperado.");
  }
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
