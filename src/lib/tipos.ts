import type { z } from "zod";
import type {
  CandidaturaSchema,
  EncajeSchema,
  EstadoCandidaturaSchema,
  OfertaSchema,
  PerfilSchema,
  PreferenciasSchema,
} from "./esquemas.ts";

// Tipos del dominio. Todo lo personal vive solo en el navegador (IndexedDB).
// Los de datos guardados salen de los schemas de `esquemas.ts`.

export type EstadoCandidatura = z.infer<typeof EstadoCandidaturaSchema>;
export type Perfil = z.infer<typeof PerfilSchema>;
export type Preferencias = z.infer<typeof PreferenciasSchema>;
export type Oferta = z.infer<typeof OfertaSchema>;
export type Encaje = z.infer<typeof EncajeSchema>;
export type Candidatura = z.infer<typeof CandidaturaSchema>;

export interface Ajustes {
  id: "ajustes";
  /** "app" usa la IA de la app; "propia" usa la clave del usuario; "demo" responde con textos de ejemplo, sin red. */
  modoIa: "app" | "propia" | "demo";
  url?: string;
  modelo?: string;
  clave?: string;
}
