// Recordatorio de hacer copia. Las fechas viven en localStorage (no son datos personales)
// y nunca bloquean la app: si el navegador no deja usarlo, simplemente no se recuerda.

const CLAVE_COPIA = "ultima-copia";
const CLAVE_POSPUESTO = "recordatorio-pospuesto";
const DIA = 24 * 60 * 60 * 1000;
export const DIAS_SIN_COPIA = 14;
export const DIAS_POSPONER = 7;

export type Almacen = Pick<Storage, "getItem" | "setItem">;

const lee = (a: Almacen, clave: string): number => {
  try {
    const n = Number(a.getItem(clave));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const escribe = (a: Almacen, clave: string, valor: number) => {
  try {
    a.setItem(clave, String(valor));
  } catch {
    // sin almacenamiento: no se recuerda y ya está
  }
};

/** Apunta que la persona acaba de guardar o exportar una copia. */
export const marcarCopia = (a: Almacen, ahora = Date.now()) => escribe(a, CLAVE_COPIA, ahora);

/** "Ahora no": no vuelve a preguntar hasta dentro de unos días. */
export const posponer = (a: Almacen, ahora = Date.now()) => escribe(a, CLAVE_POSPUESTO, ahora);

/** Toca recordar si hay datos, hace más de 14 días de la última copia (o no hay ninguna) y no se pospuso hace poco. */
export function tocaRecordar(a: Almacen, hayDatos: boolean, ahora = Date.now()): boolean {
  if (!hayDatos) return false;
  if (ahora - lee(a, CLAVE_POSPUESTO) < DIAS_POSPONER * DIA) return false;
  return ahora - lee(a, CLAVE_COPIA) >= DIAS_SIN_COPIA * DIA;
}

/** Pide al navegador que no borre los datos por falta de espacio. Devuelve si quedó concedido. */
export async function pedirPersistencia(
  almacenamiento: Pick<StorageManager, "persist" | "persisted"> | undefined = typeof navigator !==
  "undefined"
    ? navigator.storage
    : undefined,
): Promise<boolean> {
  try {
    if (!almacenamiento) return false;
    return (await almacenamiento.persisted()) || (await almacenamiento.persist());
  } catch {
    return false;
  }
}
