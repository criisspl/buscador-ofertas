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

/** Dónde se guardan los datos. Hoy solo IndexedDB; el selector admite más en el futuro. */
export const AlmacenamientoSchema = z.enum(["dexie"]);

/** Proveedores de IA predefinidos (valores sugeridos y editables) para el modo «propia». */
export const ProveedorIaSchema = z.enum(["groq", "mistral", "openai", "ollama", "otro"]);

/** Resultado de `cifrar` (`nube/cifrado.ts`): la clave de IA solo se guarda así. */
export const BlobSchema = z.strictObject({
  v: z.literal(1),
  salt: z.string(),
  iv: z.string(),
  datos: z.string(),
});

export const AjustesSchema = z.object({
  id: z.literal("ajustes"),
  /** Dónde guarda la persona sus datos. */
  almacenamiento: AlmacenamientoSchema,
  /** "app" usa la IA de la app; "propia" usa la clave del usuario; "demo" responde con textos de ejemplo, sin red. */
  modoIa: z.enum(["app", "propia", "demo"]),
  /** Proveedor predefinido elegido para el modo «propia». */
  proveedorIa: ProveedorIaSchema,
  url: z.string().max(2000).optional(),
  modelo: z.string().max(200).optional(),
  /** Clave de IA cifrada en el navegador con la contraseña de la persona. */
  claveCifrada: BlobSchema.optional(),
  /**
   * Clave heredada de antes de cifrarla, en claro. Solo la deja la migración; ya no se escribe
   * nunca y se borra en cuanto la persona la protege con contraseña.
   */
  clave: z.string().optional(),
  /** La persona ya ha pasado por el asistente de primer uso. */
  configurado: z.boolean(),
});
