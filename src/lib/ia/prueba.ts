import type { Ajustes } from "../tipos.ts";
import { ErrorIa, type ProveedorIa } from "./tipos.ts";
import { proveedorDe } from "./proveedores.ts";
import { errorDeUrl, esLocal } from "./url.ts";

export interface ResultadoPrueba {
  ok: boolean;
  mensaje: string;
}

/** Comprueba una configuración de IA con una pregunta mínima y explica el fallo en claro. */
export async function probarConexion(
  ajustes: Ajustes,
  clave?: string,
  proveedor: ProveedorIa = proveedorDe(ajustes, clave),
): Promise<ResultadoPrueba> {
  if (ajustes.modoIa === "demo")
    return { ok: true, mensaje: "El modo demo no usa red: no hay nada que probar." };

  if (ajustes.modoIa === "propia") {
    const tieneClave = !!(clave ?? ajustes.clave) || esLocal(ajustes.url);
    if (!ajustes.url || !ajustes.modelo || !tieneClave)
      return {
        ok: false,
        mensaje:
          "Faltan datos de tu IA: dirección, modelo y clave (si está protegida, desbloquéala).",
      };
    const motivo = errorDeUrl(ajustes.url);
    if (motivo) return { ok: false, mensaje: motivo };
  }

  try {
    await proveedor.preguntar({ texto: "Responde solo con la palabra: ok" });
    return { ok: true, mensaje: "Funciona: la IA ha respondido." };
  } catch (e) {
    if (!(e instanceof ErrorIa)) throw e;
    const propia = ajustes.modoIa === "propia";
    switch (e.codigo) {
      case "clave":
        return { ok: false, mensaje: "La clave no es válida o no tiene permiso para ese modelo." };
      case "cupo":
        return {
          ok: false,
          mensaje: propia
            ? "Tu proveedor dice que has superado el cupo. Espera un poco o revisa tu plan."
            : "La IA de la app está saturada ahora mismo. Prueba más tarde o usa tu propia clave.",
        };
      case "formato":
        return {
          ok: false,
          mensaje: propia
            ? "El proveedor no entiende la petición: revisa que el modelo exista y que la dirección sea la de «chat/completions»."
            : "La IA ha respondido algo inesperado.",
        };
      case "config":
        return { ok: false, mensaje: e.message };
      default:
        return {
          ok: false,
          mensaje: propia
            ? "No se ha podido conectar. Revisa la dirección y tu red; si todo está bien, puede que ese proveedor no permita llamadas desde el navegador (CORS)."
            : e.message,
        };
    }
  }
}
