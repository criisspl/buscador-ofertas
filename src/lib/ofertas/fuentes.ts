import type { Oferta } from "../tipos";

export interface Consulta {
  q: string;
  ubicacion: string;
  remoto: boolean;
}

export type Fetch = typeof fetch;

export interface Claves {
  adzunaId?: string;
  adzunaClave?: string;
  adzunaPais?: string;
  joobleClave?: string;
}

// Solo los campos que usamos de cada portal; todo puede faltar.
interface Remotive {
  id: number;
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}
interface Adzuna {
  id: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}
interface Jooble {
  id?: number | string;
  title?: string;
  company?: string;
  location?: string;
  link?: string;
  snippet?: string;
  salary?: string;
}

const MAX_DESCRIPCION = 1500;

const limpia = (html: unknown) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DESCRIPCION);

/** Solo se aceptan enlaces http(s): lo que llega de terceros acaba en un <a href>. */
const urlSegura = (u: unknown) => (/^https?:\/\//i.test(String(u)) ? String(u) : "");

function oferta(
  fuente: string,
  idExterno: unknown,
  o: Omit<Oferta, "id" | "fuente" | "idExterno">,
) {
  return {
    id: `${fuente}:${idExterno}`,
    fuente,
    idExterno: String(idExterno),
    ...o,
  } satisfies Oferta;
}

async function json<T>(f: Fetch, url: string, init?: RequestInit): Promise<T> {
  const r = await f(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function remotive(c: Consulta, f: Fetch): Promise<Oferta[]> {
  const d = await json<{ jobs?: Remotive[] }>(
    f,
    `https://remotive.com/api/remote-jobs?limit=20&search=${encodeURIComponent(c.q)}`,
  );
  return (d.jobs ?? [])
    .filter((j) => urlSegura(j.url))
    .map((j) =>
      oferta("remotive", j.id, {
        titulo: String(j.title),
        empresa: String(j.company_name ?? ""),
        ubicacion: String(j.candidate_required_location || "Remoto"),
        salario: j.salary ? String(j.salary) : undefined,
        url: j.url ?? "",
        descripcion: limpia(j.description),
      }),
    );
}

export async function adzuna(c: Consulta, k: Claves, f: Fetch): Promise<Oferta[]> {
  const pais = k.adzunaPais || "es";
  const p = new URLSearchParams({
    app_id: k.adzunaId!,
    app_key: k.adzunaClave!,
    what: c.q,
    results_per_page: "20",
  });
  if (c.ubicacion) p.set("where", c.ubicacion);
  const d = await json<{ results?: Adzuna[] }>(
    f,
    `https://api.adzuna.com/v1/api/jobs/${pais}/search/1?${p}`,
  );
  return (d.results ?? [])
    .filter((j) => urlSegura(j.redirect_url))
    .map((j) =>
      oferta("adzuna", j.id, {
        titulo: limpia(j.title),
        empresa: String(j.company?.display_name ?? ""),
        ubicacion: String(j.location?.display_name ?? ""),
        salario: j.salary_min
          ? `${Math.round(j.salary_min)}–${Math.round(j.salary_max ?? j.salary_min)}`
          : undefined,
        url: j.redirect_url ?? "",
        descripcion: limpia(j.description),
      }),
    );
}

export async function jooble(c: Consulta, k: Claves, f: Fetch): Promise<Oferta[]> {
  const d = await json<{ jobs?: Jooble[] }>(
    f,
    `https://jooble.org/api/${encodeURIComponent(k.joobleClave!)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keywords: c.q, location: c.ubicacion }),
    },
  );
  return (d.jobs ?? [])
    .filter((j) => urlSegura(j.link))
    .map((j) =>
      oferta("jooble", j.id ?? j.link, {
        titulo: limpia(j.title),
        empresa: String(j.company ?? ""),
        ubicacion: String(j.location ?? ""),
        salario: j.salary ? String(j.salary) : undefined,
        url: j.link ?? "",
        descripcion: limpia(j.snippet),
      }),
    );
}

const clave = (o: Oferta) =>
  `${o.titulo}|${o.empresa}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9|]/g, "");

/** Una misma oferta suele salir en varios portales: se queda la primera. */
export function sinDuplicados(lista: Oferta[]): Oferta[] {
  const vistas = new Set<string>();
  return lista.filter((o) => {
    const k = clave(o);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

/** Consulta todas las fuentes disponibles; si una cae, las demás siguen. */
export async function buscar(c: Consulta, k: Claves, f: Fetch = fetch) {
  const tareas: [string, Promise<Oferta[]>][] = [];
  if (c.remoto) tareas.push(["remotive", remotive(c, f)]);
  if (k.adzunaId && k.adzunaClave) tareas.push(["adzuna", adzuna(c, k, f)]);
  if (k.joobleClave) tareas.push(["jooble", jooble(c, k, f)]);
  const res = await Promise.allSettled(tareas.map(([, t]) => t));
  const ofertas: Oferta[] = [];
  const fallos: string[] = [];
  res.forEach((r, i) => {
    if (r.status === "fulfilled") ofertas.push(...r.value);
    else fallos.push(tareas[i][0]);
  });
  return { ofertas: sinDuplicados(ofertas), fallos, fuentes: tareas.length };
}
