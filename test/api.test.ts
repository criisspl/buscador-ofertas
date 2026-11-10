import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

// Upstash simulado: el límite por persona siempre pasa y el global se controla desde el test.
const upstash = vi.hoisted(() => ({
  global: { success: true },
  creados: [] as string[],
}));

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    prefijo: string;
    constructor(o: { prefix: string }) {
      this.prefijo = o.prefix;
      upstash.creados.push(o.prefix);
    }
    static slidingWindow = () => ({});
    limit = async () => (this.prefijo === "ia-dia" ? upstash.global : { success: true });
  }
  return { Ratelimit };
});

import { GET as ofertas } from "../src/app/api/ofertas/route.ts";
import { PUT as copia } from "../src/app/api/copia/route.ts";
import { POST as importar } from "../src/app/api/importar/route.ts";
import { POST as ia } from "../src/app/api/ia/route.ts";
import { MAX_BYTES } from "../src/lib/ia/valida.ts";

const URL_BASE = "https://web.test";
const peticion = (ruta: string, method: string, origen: string | null, cuerpo?: string) =>
  new Request(`${URL_BASE}/api/${ruta}`, {
    method,
    headers: origen === null ? {} : { origin: origen },
    body: cuerpo,
  });

const rutas = [
  ["ia", (o: string | null, c = "{}") => ia(peticion("ia", "POST", o, c))],
  ["importar", (o: string | null, c = "{}") => importar(peticion("importar", "POST", o, c))],
  ["ofertas", (o: string | null) => ofertas(peticion("ofertas?q=dev", "GET", o))],
  ["copia", (o: string | null, c = "{}") => copia(peticion("copia", "PUT", o, c))],
] as const;

const conUpstash = () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  upstash.global = { success: true };
});
afterEach(() => vi.unstubAllEnvs());

describe.each(rutas)("/api/%s", (_nombre, llamar) => {
  it("rechaza otro origen con 403", async () => {
    assert.equal((await llamar("https://otra.test")).status, 403);
  });
  it("rechaza Origin: null y orígenes inválidos con 403", async () => {
    assert.equal((await llamar("null")).status, 403);
    assert.equal((await llamar("no es una url")).status, 403);
  });
  it("en producción sin Upstash responde 503", async () => {
    vi.stubEnv("NODE_ENV", "production");
    assert.equal((await llamar(URL_BASE)).status, 503);
  });
});

describe("cuerpo demasiado grande", () => {
  beforeEach(conUpstash);

  it("/api/ia responde 413", async () => {
    const grande = JSON.stringify({ messages: [], x: "x".repeat(MAX_BYTES) });
    assert.equal((await ia(peticion("ia", "POST", URL_BASE, grande))).status, 413);
  });
  it("/api/importar responde 413", async () => {
    const grande = JSON.stringify({ url: "https://a.test/" + "x".repeat(20_000) });
    assert.equal((await importar(peticion("importar", "POST", URL_BASE, grande))).status, 413);
  });
  it("/api/copia responde 413", async () => {
    const grande = JSON.stringify({ blob: "x".repeat(2_000_000) });
    assert.equal((await copia(peticion("copia", "PUT", URL_BASE, grande))).status, 413);
  });
});

describe("tope diario de /api/ia", () => {
  const valido = JSON.stringify({ messages: [{ role: "user", content: "hola" }] });

  it("responde 429 al superarlo y no llama a los proveedores", async () => {
    conUpstash();
    vi.stubEnv("GROQ_API_KEY", "g");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    upstash.global = { success: false };
    const r = await ia(peticion("ia", "POST", URL_BASE, valido));
    vi.unstubAllGlobals();
    assert.equal(r.status, 429);
    assert.equal(f.mock.calls.length, 0);
  });
  it("el limitador se crea una sola vez entre peticiones", async () => {
    conUpstash();
    upstash.global = { success: false };
    await ia(peticion("ia", "POST", URL_BASE, valido));
    const tras1 = upstash.creados.length;
    await ia(peticion("ia", "POST", URL_BASE, valido));
    assert.equal(upstash.creados.length, tras1);
  });
});
