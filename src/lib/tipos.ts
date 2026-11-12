import type { z } from "zod";
import type {
  AjustesSchema,
  AlmacenamientoSchema,
  BlobSchema,
  CandidaturaSchema,
  EncajeSchema,
  EstadoCandidaturaSchema,
  OfertaSchema,
  PerfilSchema,
  PreferenciasSchema,
  ProveedorIaSchema,
} from "./esquemas.ts";

// Tipos del dominio. Todo lo personal vive solo en el navegador (IndexedDB).
// Los de datos guardados salen de los schemas de `esquemas.ts`.

export type EstadoCandidatura = z.infer<typeof EstadoCandidaturaSchema>;
export type Perfil = z.infer<typeof PerfilSchema>;
export type Preferencias = z.infer<typeof PreferenciasSchema>;
export type Oferta = z.infer<typeof OfertaSchema>;
export type Encaje = z.infer<typeof EncajeSchema>;
export type Candidatura = z.infer<typeof CandidaturaSchema>;

export type Ajustes = z.infer<typeof AjustesSchema>;
export type TipoAlmacenamiento = z.infer<typeof AlmacenamientoSchema>;
export type ProveedorIaId = z.infer<typeof ProveedorIaSchema>;
export type BlobCifrado = z.infer<typeof BlobSchema>;
