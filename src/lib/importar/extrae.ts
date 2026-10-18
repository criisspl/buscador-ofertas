import { createHash } from "node:crypto";
import type { Oferta } from "../tipos.ts";

const MAX_DESCRIPCION = 1500;

const entidades: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const aTexto = (html: unknown) =>
  String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
      }
      return entidades[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

type Json = Record<string, unknown>;
const esObjeto = (x: unknown): x is Json =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function buscarJobPosting(nodo: unknown): Json | null {
  if (Array.isArray(nodo)) {
    for (const n of nodo) {
      const r = buscarJobPosting(n);
      if (r) return r;
    }
    return null;
  }
  if (!esObjeto(nodo)) return null;
  const tipo = nodo["@type"];
  if (tipo === "JobPosting" || (Array.isArray(tipo) && tipo.includes("JobPosting"))) return nodo;
  return buscarJobPosting(nodo["@graph"]);
}

const texto = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

function ubicacion(j: Json): string {
  if (texto(j.jobLocationType) === "TELECOMMUTE") return "Remoto";
  const lugar = Array.isArray(j.jobLocation) ? j.jobLocation[0] : j.jobLocation;
  const dir = esObjeto(lugar) && esObjeto(lugar.address) ? lugar.address : null;
  if (!dir) return "";
  return [dir.addressLocality, dir.addressRegion, dir.addressCountry]
    .map((p) => (esObjeto(p) ? texto(p.name) : texto(p)))
    .filter(Boolean)
    .join(", ");
}

function salario(j: Json): string | undefined {
  const base = j.baseSalary;
  if (!esObjeto(base)) return undefined;
  const v = esObjeto(base.value) ? base.value : base;
  const min = v.minValue ?? v.value;
  const max = v.maxValue;
  const moneda = texto(base.currency) || texto(v.currency);
  if (typeof min !== "number" && typeof min !== "string") return undefined;
  const rango = max && max !== min ? `${min}–${max}` : `${min}`;
  return `${rango} ${moneda}`.trim().slice(0, 100);
}

function meta(html: string, nombre: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${nombre}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${nombre}["']`,
    "i",
  );
  const m = html.match(re);
  return aTexto(m?.[1] ?? m?.[2] ?? "");
}

export class ErrorExtraccion extends Error {}

/** Saca una oferta de una página: primero los datos estructurados (JobPosting) y, si no, el título y la descripción. */
export function extraerOferta(html: string, url: string): Oferta {
  let titulo = "";
  let empresa = "";
  let lugar = "";
  let sueldo: string | undefined;
  let descripcion = "";

  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let datos: unknown;
    try {
      datos = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const j = buscarJobPosting(datos);
    if (!j) continue;
    titulo = aTexto(j.title);
    const org = j.hiringOrganization;
    empresa = aTexto(esObjeto(org) ? org.name : org);
    lugar = ubicacion(j);
    sueldo = salario(j);
    descripcion = aTexto(j.description);
    break;
  }

  if (!titulo) {
    titulo = meta(html, "og:title") || aTexto(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    descripcion = descripcion || meta(html, "og:description") || meta(html, "description");
    empresa = empresa || meta(html, "og:site_name");
  }
  if (!titulo || descripcion.length < 30)
    throw new ErrorExtraccion("No he podido leer la oferta de esa página. Puedes añadirla a mano.");

  const idExterno = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return {
    id: `enlace:${idExterno}`,
    fuente: "enlace",
    idExterno,
    titulo: titulo.slice(0, 200),
    empresa: empresa.slice(0, 200),
    ubicacion: lugar.slice(0, 200),
    ...(sueldo ? { salario: sueldo } : {}),
    url,
    descripcion: descripcion.slice(0, MAX_DESCRIPCION),
  };
}
