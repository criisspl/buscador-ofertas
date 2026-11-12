import type { Ajustes } from "../tipos.ts";

export interface Pregunta {
  sistema?: string;
  texto: string;
  /** Pide la respuesta como un objeto JSON. */
  json?: boolean;
  /** Qué se está pidiendo; el modo demo lo usa para elegir su respuesta de ejemplo. */
  tarea?: "perfil" | "encaje" | "carta";
  signal?: AbortSignal;
}

export class ErrorIa extends Error {
  constructor(
    readonly codigo: "cupo" | "limite" | "clave" | "caida" | "formato" | "config",
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** De dónde sale la IA. Cada modo es una implementación (`proveedores.ts`). */
export interface ProveedorIa {
  readonly modo: Ajustes["modoIa"];
  /** Devuelve el texto de la respuesta o lanza `ErrorIa`. */
  preguntar(p: Pregunta): Promise<string>;
}
