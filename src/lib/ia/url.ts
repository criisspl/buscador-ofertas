const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/** La dirección es de tu propio equipo (Ollama, por ejemplo). */
export function esLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Valida el destino de la IA: https, o http solo en tu equipo. Devuelve el motivo del rechazo
 * o `undefined` si vale. Se comprueba antes de enviar nada, para que la clave no viaje en claro.
 */
export function errorDeUrl(url: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "La dirección no parece una URL.";
  }
  if (u.username || u.password) return "La dirección no puede llevar usuario ni contraseña.";
  if (u.protocol === "https:" || (u.protocol === "http:" && LOCAL.test(u.hostname)))
    return undefined;
  return "La dirección tiene que ser https (o http solo en tu equipo).";
}
