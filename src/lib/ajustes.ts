import type { Almacenamiento } from "./almacen/tipos.ts";
import { PRESETS } from "./ia/presets.ts";
import type { Ajustes } from "./tipos.ts";

/** Configuración sugerida: datos en este navegador (Dexie) y la IA de la app. */
export const ajustesSugeridos = (): Ajustes => ({
  id: "ajustes",
  almacenamiento: "dexie",
  modoIa: "app",
  proveedorIa: "groq",
  configurado: false,
});

/** Ajustes de partida para «Personalizar»: la sugerida con el modo «propia» ya rellenado. */
export const ajustesPropiaSugerida = (proveedorIa: Ajustes["proveedorIa"] = "groq"): Ajustes => ({
  ...ajustesSugeridos(),
  modoIa: "propia",
  proveedorIa,
  url: PRESETS[proveedorIa].url || undefined,
  modelo: PRESETS[proveedorIa].modelo || undefined,
});

/** Los ajustes guardados, o la configuración sugerida si aún no hay. */
export async function leerAjustesOSugeridos(almacen: Almacenamiento): Promise<Ajustes> {
  return (await almacen.leerAjustes()) ?? ajustesSugeridos();
}
