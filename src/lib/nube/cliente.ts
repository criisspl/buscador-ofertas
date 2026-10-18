import { instantanea, restaurar } from "../copia.ts";
import type { BaseDatos } from "../store.ts";
import { cifrar, descifrar, idDe, ITERACIONES, tokenDe, type Blob } from "./cifrado.ts";

export class ErrorNube extends Error {}

type Fetch = typeof fetch;

async function llamar(f: Fetch, metodo: string, url: string, cuerpo?: unknown) {
  let r: Response;
  try {
    r = await f(url, {
      method: metodo,
      headers: cuerpo ? { "content-type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorNube("No hay conexión con el servidor.");
  }
  const datos = await r.json().catch(() => ({}));
  return { r, datos };
}

/** Sube una copia cifrada. Si el alias ya existe se reutiliza su sal: solo quien conoce la contraseña puede actualizarla. */
export async function subir(
  db: BaseDatos,
  alias: string,
  password: string,
  f: Fetch = fetch,
  iteraciones = ITERACIONES,
) {
  const id = await idDe(alias);
  const previo = await llamar(f, "GET", `/api/copia?id=${id}`);
  if (previo.r.status !== 404 && !previo.r.ok)
    throw new ErrorNube(previo.datos.mensaje ?? "No se ha podido comprobar el alias.");
  const sal: string | undefined = previo.r.ok ? (previo.datos.blob as Blob).salt : undefined;
  const blob = await cifrar(await instantanea(db), password, sal, iteraciones);
  const token = await tokenDe(password, blob.salt, iteraciones);
  const { r, datos } = await llamar(f, "PUT", "/api/copia", { id, token, blob });
  if (!r.ok) throw new ErrorNube(datos.mensaje ?? "No se ha podido guardar la copia.");
  return datos.actualizada as number;
}

export async function bajar(
  db: BaseDatos,
  alias: string,
  password: string,
  f: Fetch = fetch,
  iteraciones = ITERACIONES,
) {
  const { r, datos } = await llamar(f, "GET", `/api/copia?id=${await idDe(alias)}`);
  if (!r.ok) throw new ErrorNube(datos.mensaje ?? "No se ha podido recuperar la copia.");
  await restaurar(db, await descifrar(datos.blob as Blob, password, iteraciones));
  return datos.actualizada as number;
}

export async function borrarCopia(
  alias: string,
  password: string,
  f: Fetch = fetch,
  iteraciones = ITERACIONES,
) {
  const id = await idDe(alias);
  const previo = await llamar(f, "GET", `/api/copia?id=${id}`);
  if (!previo.r.ok) throw new ErrorNube(previo.datos.mensaje ?? "No hay copia que borrar.");
  const token = await tokenDe(password, (previo.datos.blob as Blob).salt, iteraciones);
  const { r, datos } = await llamar(f, "DELETE", "/api/copia", { id, token });
  if (!r.ok) throw new ErrorNube(datos.mensaje ?? "No se ha podido borrar la copia.");
}
