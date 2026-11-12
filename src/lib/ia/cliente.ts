import type { Ajustes } from "../tipos.ts";
import { proveedorDe } from "./proveedores.ts";
import type { Pregunta } from "./tipos.ts";

export { ErrorIa, type Pregunta } from "./tipos.ts";

/** Pregunta a la IA de la app (por /api/ia) o a la del usuario, según sus ajustes. */
export async function preguntar(ajustes: Ajustes, p: Pregunta): Promise<string> {
  return proveedorDe(ajustes).preguntar(p);
}
