import { z } from "zod";

// Schemas de los datos de la persona. De aquí salen los tipos (`tipos.ts`) y la validación
// de las copias de seguridad (`copia.ts`, `candidaturas.ts`).

export const EstadoCandidaturaSchema = z.enum([
  "guardada",
  "enviada",
  "contacto",
  "entrevista",
  "oferta",
  "rechazada",
  "descartada",
  "cerrada",
]);

export const PerfilSchema = z.object({
  id: z.literal("perfil"),
  skills: z.array(z.string()),
  experiencia: z.array(
    z.object({
      puesto: z.string(),
      empresa: z.string(),
      desde: z.string().optional(),
      hasta: z.string().optional(),
    }),
  ),
  idiomas: z.array(z.string()),
  textoCv: z.string(),
});

export const PreferenciasSchema = z.object({
  id: z.literal("preferencias"),
  puestos: z.array(z.string()),
  ubicacion: z.string(),
  remoto: z.boolean(),
  salarioMinimo: z.number().optional(),
  jornada: z.enum(["completa", "parcial", "cualquiera"]).optional(),
  sectoresEvitar: z.array(z.string()),
});

export const OfertaSchema = z.object({
  /** `${fuente}:${idExterno}`, para deduplicar entre portales. */
  id: z.string().max(300),
  fuente: z.string().max(50),
  idExterno: z.string().max(300),
  titulo: z.string().max(300),
  empresa: z.string().max(300),
  ubicacion: z.string().max(300),
  salario: z.string().max(100).optional(),
  /** Vacía en las ofertas añadidas a mano sin enlace. */
  url: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^https?:\/\//i)
      .max(2000),
  ]),
  descripcion: z.string().max(5000),
});

export const EncajeSchema = z.object({
  ofertaId: z.string().max(300),
  nota: z.number(),
  cumple: z.array(z.string()),
  falta: z.array(z.string()),
  proveedor: z.string(),
});

export const CandidaturaSchema = z.object({
  ofertaId: z.string().max(300),
  estado: EstadoCandidaturaSchema,
  carta: z.string().max(10_000),
  notas: z.string().max(10_000),
  creada: z.number(),
  actualizada: z.number(),
});
