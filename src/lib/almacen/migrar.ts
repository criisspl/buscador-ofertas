import { leerCopia, instantanea, serializar } from "../copia.ts";
import type { Almacenamiento, Datos } from "./tipos.ts";

export type FaseMigracion =
  "leyendo" | "validando" | "copia-previa" | "escribiendo" | "verificando";

export const FASES: FaseMigracion[] = [
  "leyendo",
  "validando",
  "copia-previa",
  "escribiendo",
  "verificando",
];

export type CodigoErrorMigracion =
  | "mismo-almacen"
  | "lectura"
  | "origen-invalido"
  | "destino-no-vacio"
  | "cancelada"
  | "escritura"
  | "verificacion";

/**
 * Fallo de una migración. El origen nunca se escribe, así que siempre queda intacto. Si el
 * destino tenía datos, `copiaPrevia` trae su copia anterior para que la persona la guarde.
 */
export class ErrorMigracion extends Error {
  constructor(
    readonly codigo: CodigoErrorMigracion,
    mensaje: string,
    readonly copiaPrevia?: string,
  ) {
    super(mensaje);
    this.name = "ErrorMigracion";
  }
}

export interface OpcionesMigracion {
  /** Confirmación explícita para escribir en un destino que ya tiene datos. */
  sobrescribir?: boolean;
  alProgreso?: (fase: FaseMigracion, paso: number, total: number) => void;
  /** Se puede cancelar hasta justo antes de escribir; después la escritura ya es atómica. */
  senal?: AbortSignal;
}

export interface ResultadoMigracion {
  perfil: boolean;
  ofertas: number;
  encajes: number;
  candidaturas: number;
  /** Copia (JSON) de lo que había en el destino, si tenía datos. */
  copiaPrevia?: string;
}

const hayAlgo = (d: Datos) =>
  !!d.perfil || !!d.preferencias || d.ofertas.length + d.encajes.length + d.candidaturas.length > 0;

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : "error desconocido");

/**
 * Copia todos los datos de `origen` a `destino`. Solo viajan los datos de la persona, en la
 * misma forma que ya recibía el origen; los ajustes (con la clave de IA) nunca se copian y el
 * destino conserva los suyos. Todo pasa por la validación de la copia, que descarta lo
 * desconocido. Si el destino ya tiene datos hace falta `sobrescribir`: lo que coincide por clave
 * se sustituye y lo demás se conserva.
 */
export async function migrar(
  origen: Almacenamiento,
  destino: Almacenamiento,
  { sobrescribir = false, alProgreso, senal }: OpcionesMigracion = {},
): Promise<ResultadoMigracion> {
  if (origen === destino)
    throw new ErrorMigracion(
      "mismo-almacen",
      "El origen y el destino son el mismo almacenamiento.",
    );
  const total = FASES.length;
  const paso = (fase: FaseMigracion) => alProgreso?.(fase, FASES.indexOf(fase) + 1, total);
  const cancelable = (copiaPrevia?: string) => {
    if (senal?.aborted)
      throw new ErrorMigracion(
        "cancelada",
        "Migración cancelada. No se ha cambiado nada en ninguno de los dos almacenamientos.",
        copiaPrevia,
      );
  };

  cancelable();
  paso("leyendo");
  let texto: string;
  try {
    texto = await instantanea(origen);
  } catch (e) {
    throw new ErrorMigracion(
      "lectura",
      `No se han podido leer los datos de origen: ${mensajeDe(e)}`,
    );
  }

  cancelable();
  paso("validando");
  let datos: Datos;
  try {
    datos = leerCopia(texto);
  } catch (e) {
    throw new ErrorMigracion(
      "origen-invalido",
      `Los datos de origen no son válidos, no se copia nada. ${mensajeDe(e)}`,
    );
  }

  cancelable();
  paso("copia-previa");
  let copiaPrevia: string | undefined;
  try {
    const previos = await destino.leerDatos();
    if (hayAlgo(previos)) {
      if (!sobrescribir)
        throw new ErrorMigracion(
          "destino-no-vacio",
          "El destino ya tiene datos. Confirma que quieres sobrescribirlos para continuar.",
        );
      copiaPrevia = serializar(previos);
    }
  } catch (e) {
    if (e instanceof ErrorMigracion) throw e;
    throw new ErrorMigracion("lectura", `No se ha podido leer el destino: ${mensajeDe(e)}`);
  }

  cancelable(copiaPrevia);
  paso("escribiendo");
  try {
    await destino.escribirLote(datos);
  } catch (e) {
    throw new ErrorMigracion(
      "escritura",
      `No se ha podido escribir en el destino: ${mensajeDe(e)}. Tus datos de origen siguen intactos.`,
      copiaPrevia,
    );
  }

  paso("verificando");
  try {
    const escrito = leerCopia(serializar(await destino.leerDatos()));
    if (!contiene(escrito, datos)) throw new Error("lo escrito no coincide con el origen");
  } catch (e) {
    throw new ErrorMigracion(
      "verificacion",
      `El destino no queda como el origen (${mensajeDe(e)}). Tus datos de origen siguen intactos; revisa el destino.`,
      copiaPrevia,
    );
  }

  return {
    perfil: !!datos.perfil,
    ofertas: datos.ofertas.length,
    encajes: datos.encajes.length,
    candidaturas: datos.candidaturas.length,
    copiaPrevia,
  };
}

/** `destino` incluye todo lo de `origen`, igual (el destino puede tener además lo suyo). */
function contiene(destino: Datos, origen: Datos): boolean {
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const todos = <T>(de: T[], en: T[], clave: (x: T) => string) => {
    const mapa = new Map(en.map((x) => [clave(x), x]));
    return de.every((x) => igual(mapa.get(clave(x)), x));
  };
  return (
    (!origen.perfil || igual(destino.perfil, origen.perfil)) &&
    (!origen.preferencias || igual(destino.preferencias, origen.preferencias)) &&
    todos(origen.ofertas, destino.ofertas, (o) => o.id) &&
    todos(origen.encajes, destino.encajes, (e) => e.ofertaId) &&
    todos(origen.candidaturas, destino.candidaturas, (c) => c.ofertaId)
  );
}
