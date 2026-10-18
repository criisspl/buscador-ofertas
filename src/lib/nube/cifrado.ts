// Cifrado en el navegador: el servidor solo ve el blob cifrado y un token, nunca la contraseña.
// contraseña --PBKDF2--> clave maestra --HKDF--> clave AES-GCM y token de propiedad (independientes).

export const ITERACIONES = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Blob {
  v: 1;
  salt: string;
  iv: string;
  datos: string;
}

// Por trozos: String.fromCharCode(...b) revienta la pila con copias de cientos de KB.
export const aB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const nuevaSal = () => aB64(crypto.getRandomValues(new Uint8Array(16)));

async function maestra(password: string, salt: string, iteraciones: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: deB64(salt), iterations: iteraciones },
    base,
    256,
  );
  return crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveBits", "deriveKey"]);
}

const hkdf = { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0) } as const;

/** Prueba de que conoces la contraseña. El servidor solo guarda su hash. */
export async function tokenDe(password: string, salt: string, iteraciones = ITERACIONES) {
  const m = await maestra(password, salt, iteraciones);
  const bits = await crypto.subtle.deriveBits({ ...hkdf, info: enc.encode("token") }, m, 256);
  return aB64(new Uint8Array(bits));
}

async function claveAes(password: string, salt: string, iteraciones: number) {
  const m = await maestra(password, salt, iteraciones);
  return crypto.subtle.deriveKey(
    { ...hkdf, info: enc.encode("cifrado") },
    m,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function cifrar(
  texto: string,
  password: string,
  salt = nuevaSal(),
  iteraciones = ITERACIONES,
): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await claveAes(password, salt, iteraciones);
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, enc.encode(texto));
  return { v: 1, salt, iv: aB64(iv), datos: aB64(new Uint8Array(datos)) };
}

export class ErrorDescifrado extends Error {}

export async function descifrar(blob: Blob, password: string, iteraciones = ITERACIONES) {
  try {
    const clave = await claveAes(password, blob.salt, iteraciones);
    const datos = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deB64(blob.iv) },
      clave,
      deB64(blob.datos),
    );
    return dec.decode(datos);
  } catch {
    throw new ErrorDescifrado("Contraseña incorrecta o copia dañada.");
  }
}

/** Identificador público de la copia: hash del alias, así el servidor no guarda el alias en claro. */
export async function idDe(alias: string) {
  const h = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`buscador-ofertas:${alias.trim().toLowerCase()}`),
  );
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
