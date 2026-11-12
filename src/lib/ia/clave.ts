import { cifrar, descifrar, ITERACIONES } from "../nube/cifrado.ts";
import type { BlobCifrado } from "../tipos.ts";

// La clave de IA de la persona solo se guarda cifrada (AES-GCM, clave derivada de su contraseña
// con PBKDF2, la misma cripto que la copia en la nube). Descifrada vive solo en memoria de esta
// pestaña: no va a IndexedDB, ni a la copia, ni a ficheros ni a logs.

export const MIN_PASSWORD = 8;

export const cifrarClave = (
  clave: string,
  password: string,
  iteraciones = ITERACIONES,
): Promise<BlobCifrado> => cifrar(clave, password, undefined, iteraciones);

/** Lanza `ErrorDescifrado` si la contraseña no es la que cifró la clave. */
export const descifrarClave = (blob: BlobCifrado, password: string, iteraciones = ITERACIONES) =>
  descifrar(blob, password, iteraciones);

let enMemoria: string | undefined;

/** La clave descifrada en esta sesión, si la persona la ha desbloqueado. */
export const claveDesbloqueada = () => enMemoria;
export const desbloquear = (clave: string) => {
  enMemoria = clave;
};
export const bloquear = () => {
  enMemoria = undefined;
};
