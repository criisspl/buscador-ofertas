import type { TipoAlmacenamiento } from "../tipos.ts";

/** Almacenamientos que la persona puede elegir. Un adaptador nuevo se añade aquí y en el esquema. */
export const OPCIONES_ALMACENAMIENTO: { id: TipoAlmacenamiento; nombre: string }[] = [
  { id: "dexie", nombre: "En este navegador (IndexedDB)" },
];
