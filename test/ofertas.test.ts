import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { GET } from "../src/app/api/ofertas/route.ts";
import { buscar, sinDuplicados } from "../src/lib/ofertas/fuentes.ts";

const c = { q: "react", ubicacion: "Madrid", remoto: true };
const resp = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

const REMOTIVE = {
  jobs: [
    {
      id: 1,
      url: "https://remotive.com/1",
      title: "Frontend Dev",
      company_name: "Acme",
      candidate_required_location: "Europe",
      description: "<p>Usa <b>React</b>&nbsp;a diario</p>",
    },
    { id: 2, url: "javascript:alert(1)", title: "Malo", company_name: "X" },
  ],
};
const ADZUNA = {
  results: [
    {
      id: "9",
      title: "frontend dev",
      company: { display_name: "ACME" },
      location: { display_name: "Madrid" },
      redirect_url: "https://adzuna.test/9",
      description: "React",
      salary_min: 30000,
      salary_max: 40000,
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("buscar", () => {
  it("limpia el HTML y descarta enlaces que no sean http(s)", async () => {
    const f = vi.fn().mockResolvedValue(resp(REMOTIVE));
    const r = await buscar(c, {}, f);
    assert.equal(r.ofertas.length, 1);
    assert.equal(r.ofertas[0].descripcion, "Usa React a diario");
    assert.equal(r.ofertas[0].id, "remotive:1");
  });
  it("junta fuentes, deduplica por título y empresa y sigue si una falla", async () => {
    const f = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("remotive")
        ? resp(REMOTIVE)
        : String(url).includes("adzuna")
          ? resp(ADZUNA)
          : resp({}, 500),
    ) as unknown as typeof fetch;
    const r = await buscar(c, { adzunaId: "i", adzunaClave: "k", joobleClave: "j" }, f);
    assert.deepEqual(r.fallos, ["jooble"]);
    assert.equal(r.ofertas.length, 1);
    assert.equal(r.ofertas[0].fuente, "remotive");
  });
  it("sin remoto y sin claves no consulta nada", async () => {
    const f = vi.fn();
    const r = await buscar({ ...c, remoto: false }, {}, f);
    assert.equal(r.fuentes, 0);
    assert.equal(f.mock.calls.length, 0);
  });
  it("sinDuplicados ignora mayúsculas y acentos", () => {
    const o = { fuente: "a", idExterno: "1", ubicacion: "", url: "https://x", descripcion: "" };
    const lista = [
      { ...o, id: "a:1", titulo: "Ingeniería", empresa: "Acme" },
      { ...o, id: "b:2", titulo: "INGENIERIA", empresa: "acme" },
    ];
    assert.equal(sinDuplicados(lista).length, 1);
  });
});

describe("GET /api/ofertas", () => {
  const pet = (query: string, origen = "https://web.test") =>
    new Request(`https://web.test/api/ofertas${query}`, { headers: { origin: origen } });

  it("rechaza otros orígenes y búsquedas vacías", async () => {
    assert.equal((await GET(pet("?q=a", "https://otra.test"))).status, 403);
    assert.equal((await GET(pet("?q="))).status, 400);
  });
  it("sin límite configurado, en producción no responde", async () => {
    vi.stubEnv("NODE_ENV", "production");
    assert.equal((await GET(pet("?q=a"))).status, 503);
  });
  it("devuelve ofertas de Remotive", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(REMOTIVE)));
    const r = await GET(pet("?q=react&remoto=1"));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ofertas.length, 1);
  });
  it("503 si no hay ninguna fuente", async () => {
    vi.stubEnv("NODE_ENV", "test");
    assert.equal((await GET(pet("?q=react"))).status, 503);
  });
});
