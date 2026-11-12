import { leerAjustesOSugeridos } from "../ajustes.ts";
import type { Almacenamiento } from "../almacen/tipos.ts";
import { claveDesbloqueada } from "./clave.ts";
import { proveedorDe } from "./proveedores.ts";
import type { ProveedorIa } from "./tipos.ts";

/** El proveedor de IA que toca ahora según los ajustes guardados y la clave desbloqueada. */
export async function proveedorActual(almacen: Almacenamiento): Promise<ProveedorIa> {
  return proveedorDe(await leerAjustesOSugeridos(almacen), claveDesbloqueada());
}
