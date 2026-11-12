import type { Ajustes, Candidatura, Encaje, Oferta, Perfil, Preferencias } from "../tipos.ts";

/** Lo que se puede escribir de una vez. Cada parte que falte se deja como está. */
export interface Lote {
  ajustes?: Ajustes;
  perfil?: Perfil;
  preferencias?: Preferencias;
  ofertas?: Oferta[];
  encajes?: Encaje[];
  candidaturas?: Candidatura[];
}

/** Todos los datos de la persona, sin los ajustes (llevan la clave de IA). */
export interface Datos {
  perfil?: Perfil;
  preferencias?: Preferencias;
  ofertas: Oferta[];
  encajes: Encaje[];
  candidaturas: Candidatura[];
}

/**
 * Dónde guarda la app los datos de la persona. Las páginas y la lógica solo conocen esta
 * interfaz; hoy la implementa IndexedDB (`dexie.ts`).
 *
 * Contrato común:
 * - `leer*` / `obtener*` devuelven `undefined` (o un hueco en el array) si no existe.
 * - `guardar*` crea o sustituye por clave (put). No hay duplicados.
 * - `escribirLote` es atómico: o entra todo o no entra nada.
 * - `observar` vuelve a leer cuando cambian los datos, también desde otra pestaña.
 */
export interface Almacenamiento {
  leerAjustes(): Promise<Ajustes | undefined>;
  guardarAjustes(ajustes: Ajustes): Promise<void>;

  leerPerfil(): Promise<Perfil | undefined>;
  guardarPerfil(perfil: Perfil): Promise<void>;

  leerPreferencias(): Promise<Preferencias | undefined>;
  guardarPreferencias(preferencias: Preferencias): Promise<void>;

  listarOfertas(): Promise<Oferta[]>;
  obtenerOfertas(ids: string[]): Promise<(Oferta | undefined)[]>;
  guardarOferta(oferta: Oferta): Promise<void>;
  guardarOfertas(ofertas: Oferta[]): Promise<void>;
  /** Borra las ofertas sin candidatura y sus encajes. Devuelve cuántas ofertas ha borrado. */
  borrarOfertasNoGuardadas(): Promise<number>;

  listarEncajes(): Promise<Encaje[]>;
  obtenerEncajes(ofertaIds: string[]): Promise<(Encaje | undefined)[]>;
  guardarEncaje(encaje: Encaje): Promise<void>;

  /** Por clave (id de la oferta). */
  listarCandidaturas(): Promise<Candidatura[]>;
  /** De la modificada más reciente a la más antigua. */
  listarCandidaturasRecientes(): Promise<Candidatura[]>;
  idsCandidaturas(): Promise<string[]>;
  obtenerCandidatura(ofertaId: string): Promise<Candidatura | undefined>;
  guardarCandidatura(candidatura: Candidatura): Promise<void>;
  /** Cambia solo esos campos. Si no existe, no hace nada. */
  actualizarCandidatura(ofertaId: string, cambios: Partial<Candidatura>): Promise<void>;
  borrarCandidatura(ofertaId: string): Promise<void>;

  /** Hay perfil o candidaturas, es decir, algo que se perdería. */
  hayDatos(): Promise<boolean>;
  leerDatos(): Promise<Datos>;
  escribirLote(lote: Lote): Promise<void>;

  /**
   * Llama a `alCambiar` con el resultado de `leer` ahora y cada vez que cambien los datos
   * que `leer` consulta. Un fallo de lectura no se propaga: se queda el último valor.
   * Devuelve la función que cancela la suscripción.
   */
  observar<T>(leer: () => Promise<T>, alCambiar: (valor: T) => void): () => void;
}
