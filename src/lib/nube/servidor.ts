import { createHash, timingSafeEqual } from "node:crypto";

// El servidor guarda un blob cifrado que no puede leer, más el hash de un token para saber quién puede cambiarlo.
export const MAX_BLOB = 900_000;
export const CADUCA_SEGUNDOS = 365 * 24 * 3600;

export interface Registro {
  tokenHash: string;
  blob: unknown;
  actualizada: number;
}

export interface Almacen {
  get(clave: string): Promise<Registro | null>;
  set(clave: string, valor: Registro, caducaSegundos: number): Promise<void>;
  del(clave: string): Promise<void>;
}

const ID = /^[0-9a-f]{64}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

const igual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function blobValido(b: unknown): boolean {
  if (typeof b !== "object" || b === null) return false;
  const x = b as Record<string, unknown>;
  return (
    x.v === 1 &&
    ["salt", "iv", "datos"].every((k) => typeof x[k] === "string" && B64.test(x[k] as string))
  );
}

export type Respuesta = { status: number; cuerpo: unknown };
const err = (status: number, error: string, mensaje: string): Respuesta => ({
  status,
  cuerpo: { error, mensaje },
});

export async function leer(a: Almacen, id: string | null): Promise<Respuesta> {
  if (!id || !ID.test(id)) return err(400, "formato", "Identificador no válido.");
  const r = await a.get(`copia:${id}`);
  if (!r) return err(404, "nada", "No hay ninguna copia con ese alias.");
  return { status: 200, cuerpo: { blob: r.blob, actualizada: r.actualizada } };
}

export async function escribir(
  a: Almacen,
  entrada: unknown,
  ahora = Date.now(),
): Promise<Respuesta> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  if (
    typeof e.id !== "string" ||
    !ID.test(e.id) ||
    typeof e.token !== "string" ||
    e.token.length > 100
  )
    return err(400, "formato", "Petición no válida.");
  if (!blobValido(e.blob)) return err(400, "formato", "La copia no tiene el formato esperado.");
  if (JSON.stringify(e.blob).length > MAX_BLOB)
    return err(413, "grande", "La copia pesa demasiado para guardarla.");
  const clave = `copia:${e.id}`;
  const previo = await a.get(clave);
  if (previo && !igual(previo.tokenHash, hash(e.token)))
    return err(403, "token", "Esa copia ya existe con otra contraseña.");
  await a.set(
    clave,
    { tokenHash: hash(e.token), blob: e.blob, actualizada: ahora },
    CADUCA_SEGUNDOS,
  );
  return { status: 200, cuerpo: { actualizada: ahora } };
}

export async function borrar(a: Almacen, entrada: unknown): Promise<Respuesta> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  if (typeof e.id !== "string" || !ID.test(e.id) || typeof e.token !== "string")
    return err(400, "formato", "Petición no válida.");
  const previo = await a.get(`copia:${e.id}`);
  if (!previo) return err(404, "nada", "No hay ninguna copia con ese alias.");
  if (!igual(previo.tokenHash, hash(e.token))) return err(403, "token", "Contraseña incorrecta.");
  await a.del(`copia:${e.id}`);
  return { status: 200, cuerpo: { ok: true } };
}
