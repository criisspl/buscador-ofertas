import type { TipoAlmacenamiento } from "../tipos.ts";
import type { Almacenamiento } from "./tipos.ts";

/** Almacenamientos que la persona puede elegir. Un adaptador nuevo se añade aquí y en el esquema. */
export const OPCIONES_ALMACENAMIENTO: { id: TipoAlmacenamiento; nombre: string }[] = [
  { id: "dexie", nombre: "En este navegador (IndexedDB)" },
];

/** A dónde se puede copiar la información desde Ajustes. */
export interface DestinoMigracion {
  id: TipoAlmacenamiento;
  nombre: string;
  /** Abre el almacenamiento destino. */
  crear: () => Almacenamiento;
}

/**
 * Hoy solo existe el adaptador de IndexedDB, que ya es el origen: no hay a dónde copiar.
 * Un adaptador nuevo se añade aquí y aparece solo en «Copiar a otro almacenamiento».
 */
export const DESTINOS_MIGRACION: DestinoMigracion[] = [];
