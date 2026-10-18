import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Descarga segura de una página que indica la persona. El servidor hace la petición, así que
// hay que impedir que la use para llegar a la red interna (SSRF): se valida la IP real a la
// que se conecta (no solo el nombre), en cada redirección, y sin guardar nada.

export class ErrorDescarga extends Error {}

export const MAX_BYTES = 1_000_000;
const MAX_REDIRECCIONES = 3;
const TIMEOUT_MS = 8000;

function ipv4Privada(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // enlace local y metadatos de la nube
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast y reservadas
  );
}

/** true si la IP NO es de una red pública. Ante la duda (formato raro), se considera privada. */
export function esPrivada(ip: string): boolean {
  const tipo = net.isIP(ip);
  if (tipo === 4) return ipv4Privada(ip);
  if (tipo !== 6) return true;
  const l = ip.toLowerCase();
  const mapeada = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeada) return ipv4Privada(mapeada[1]);
  // Una IPv4 mapeada escrita en hexadecimal (::ffff:7f00:1)
  const hex = l.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
    return ipv4Privada([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  return (
    l === "::" ||
    l === "::1" ||
    l.startsWith("fc") ||
    l.startsWith("fd") || // únicas locales
    /^fe[89ab]/.test(l) || // enlace local
    l.startsWith("ff") // multicast
  );
}

type Resolver = (host: string) => Promise<string[]>;
const resolverDns: Resolver = async (host) =>
  (await dns.promises.lookup(host, { all: true })).map((d) => d.address);

/** Lookup que solo deja conectar si TODAS las direcciones del nombre son públicas. */
function lookupSeguro(resolver: Resolver, permitirPrivadas: boolean) {
  return (
    host: string,
    opciones: dns.LookupOptions,
    cb: (err: Error | null, a?: string | dns.LookupAddress[], f?: number) => void,
  ) => {
    resolver(host)
      .then((ips) => {
        if (ips.length === 0) throw new ErrorDescarga("No se ha encontrado esa dirección.");
        if (!permitirPrivadas && ips.some(esPrivada))
          throw new ErrorDescarga("Esa dirección no está permitida.");
        if (opciones.all)
          cb(
            null,
            ips.map((address) => ({ address, family: net.isIP(address) })),
          );
        else cb(null, ips[0], net.isIP(ips[0]));
      })
      .catch((e) => cb(e instanceof Error ? e : new Error(String(e))));
  };
}

export interface OpcionesDescarga {
  /** Solo para los tests: permite conectar a direcciones y puertos locales. */
  permitirPrivadas?: boolean;
  resolver?: Resolver;
}

export function urlValida(texto: string, cualquierPuerto = false): URL {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    throw new ErrorDescarga("Eso no parece un enlace.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new ErrorDescarga("El enlace tiene que empezar por http o https.");
  if (u.username || u.password)
    throw new ErrorDescarga("El enlace no puede llevar usuario ni contraseña.");
  if (!cualquierPuerto && u.port && u.port !== (u.protocol === "https:" ? "443" : "80"))
    throw new ErrorDescarga("Ese puerto no está permitido.");
  return u;
}

function pedir(
  u: URL,
  o: OpcionesDescarga,
): Promise<{ status: number; location?: string; tipo: string; cuerpo: string }> {
  return new Promise((resolve, reject) => {
    const host = u.hostname.replace(/^\[|\]$/g, "");
    // Una IP escrita directamente no pasa por lookup: se valida aquí.
    if (net.isIP(host) && !o.permitirPrivadas && esPrivada(host))
      return reject(new ErrorDescarga("Esa dirección no está permitida."));

    const modulo = u.protocol === "https:" ? https : http;
    const req = modulo.request(
      u,
      {
        method: "GET",
        lookup: lookupSeguro(o.resolver ?? resolverDns, !!o.permitirPrivadas) as never,
        headers: {
          "user-agent": "buscador-ofertas/1.0 (+importar oferta por enlace)",
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const tipo = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, tipo, cuerpo: "" });
        }
        const trozos: Buffer[] = [];
        let total = 0;
        res.on("data", (t: Buffer) => {
          total += t.length;
          if (total > MAX_BYTES) {
            req.destroy(new ErrorDescarga("La página pesa demasiado."));
            return;
          }
          trozos.push(t);
        });
        res.on("end", () =>
          resolve({ status, tipo, cuerpo: Buffer.concat(trozos).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () =>
      req.destroy(new ErrorDescarga("La página tarda demasiado en responder.")),
    );
    req.on("error", (e) =>
      reject(
        e instanceof ErrorDescarga ? e : new ErrorDescarga("No se ha podido abrir esa página."),
      ),
    );
    req.end();
  });
}

/** Descarga el HTML de una página pública siguiendo como mucho 3 redirecciones, validando cada salto. */
export async function descargarHtml(enlace: string, o: OpcionesDescarga = {}) {
  let u = urlValida(enlace, o.permitirPrivadas);
  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const r = await pedir(u, o);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) throw new ErrorDescarga("La página redirige a un sitio no válido.");
      u = urlValida(new URL(r.location, u).toString(), o.permitirPrivadas);
      continue;
    }
    if (r.status < 200 || r.status >= 300)
      throw new ErrorDescarga(`La página responde con un error (${r.status}).`);
    if (!/html|xml/i.test(r.tipo)) throw new ErrorDescarga("Esa dirección no es una página web.");
    return { url: u.toString(), html: r.cuerpo };
  }
  throw new ErrorDescarga("La página redirige demasiadas veces.");
}
