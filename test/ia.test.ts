import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { POST } from "../src/app/api/ia/route.ts";
import { ErrorIa, preguntar } from "../src/lib/ia/cliente.ts";
import { llamarProveedores, type Proveedor } from "../src/lib/ia/servidor.ts";
import { valida } from "../src/lib/ia/valida.ts";

const ok = (texto = "hola") =>
  new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }), { status: 200 });
const estado = (s: number) => new Response("{}", { status: s });
const prov = (nombre: string): Proveedor => ({
  nombre,
  url: `https://${nombre}.test`,
  modelo: "m",
  clave: "k",
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("valida", () => {
  it("acepta un mensaje de texto", () => {
    assert.equal(valida({ messages: [{ role: "user", content: "hola" }] }).ok, true);
  });
  it("rechaza roles no permitidos, imágenes y textos enormes", () => {
    assert.equal(valida({ messages: [{ role: "assistant", content: "x" }] }).ok, false);
    assert.equal(
      valida({ messages: [{ role: "user", content: [{ type: "image_url" }] }] }).ok,
      false,
    );
    assert.equal(valida({ messages: [{ role: "user", content: "x".repeat(40_001) }] }).ok, false);
    assert.equal(valida({ messages: [] }).ok, false);
    assert.equal(valida(null).ok, false);
  });
});

describe("llamarProveedores", () => {
  const entrada = { messages: [{ role: "user" as const, content: "hola" }] };

  it("usa el principal si responde", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    const r = await llamarProveedores(entrada, [prov("groq"), prov("mistral")], f);
    assert.equal(r.ok, true);
    assert.equal(f.mock.calls.length, 1);
  });
  it("pasa a la reserva si el principal da 429, 5xx, clave rechazada o error de red", async () => {
    for (const primero of [estado(429), estado(503), estado(401), new Error("red")]) {
      const f = vi.fn();
      if (primero instanceof Error) f.mockRejectedValueOnce(primero);
      else f.mockResolvedValueOnce(primero);
      f.mockResolvedValueOnce(ok("reserva"));
      const r = await llamarProveedores(entrada, [prov("groq"), prov("mistral")], f);
      assert.equal(r.ok && r.cuerpo.includes("reserva"), true);
      assert.equal(f.mock.calls[1][0], "https://mistral.test");
    }
  });
  it("devuelve cupo si todos están saturados y caida si todos fallan", async () => {
    const saturado = vi.fn().mockResolvedValue(estado(429));
    assert.deepEqual(await llamarProveedores(entrada, [prov("a"), prov("b")], saturado), {
      ok: false,
      error: "cupo",
    });
    const caido = vi.fn().mockResolvedValue(estado(500));
    assert.deepEqual(await llamarProveedores(entrada, [prov("a")], caido), {
      ok: false,
      error: "caida",
    });
  });
  it("devuelve config si no hay proveedores", async () => {
    assert.deepEqual(await llamarProveedores(entrada, []), { ok: false, error: "config" });
  });
  it("el servidor pone el modelo y no se lo deja elegir al cliente", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    await llamarProveedores({ ...entrada, model: "caro" } as never, [prov("groq")], f);
    assert.equal(JSON.parse(f.mock.calls[0][1].body).model, "m");
  });
});

describe("POST /api/ia", () => {
  const peticion = (cuerpo: unknown, origen = "https://web.test") =>
    new Request("https://web.test/api/ia", {
      method: "POST",
      headers: { origin: origen },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    });
  const valido = { messages: [{ role: "user", content: "hola" }] };

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("MISTRAL_API_KEY", "m");
  });

  it("rechaza otros orígenes", async () => {
    assert.equal((await POST(peticion(valido, "https://otra.test"))).status, 403);
  });
  it("rechaza JSON roto y entradas no válidas", async () => {
    assert.equal((await POST(peticion("{roto"))).status, 400);
    assert.equal((await POST(peticion({ messages: [] }))).status, 400);
  });
  it("sin límite configurado, en producción no responde", async () => {
    vi.stubEnv("NODE_ENV", "production");
    assert.equal((await POST(peticion(valido))).status, 503);
  });
  it("sin claves de proveedor responde 503", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
    assert.equal((await POST(peticion(valido))).status, 503);
  });
  it("reenvía a Groq y cae a Mistral si Groq está saturado", async () => {
    const f = vi.fn().mockResolvedValueOnce(estado(429)).mockResolvedValueOnce(ok("desde mistral"));
    vi.stubGlobal("fetch", f);
    const r = await POST(peticion(valido));
    assert.equal(r.status, 200);
    assert.match(await r.text(), /desde mistral/);
    assert.match(f.mock.calls[1][0], /mistral/);
  });
});

describe("preguntar", () => {
  const app = { id: "ajustes", modoIa: "app" } as const;
  const propia = {
    id: "ajustes",
    modoIa: "propia",
    url: "https://x.test/v1",
    modelo: "m",
    clave: "k",
  } as const;

  it("con la IA de la app llama a /api/ia sin clave", async () => {
    const f = vi.fn().mockResolvedValue(ok("hecho"));
    vi.stubGlobal("fetch", f);
    assert.equal(await preguntar(app, { texto: "hola" }), "hecho");
    assert.equal(f.mock.calls[0][0], "/api/ia");
    assert.equal(f.mock.calls[0][1].headers.authorization, undefined);
  });
  it("con clave propia llama directo al proveedor del usuario", async () => {
    const f = vi.fn().mockResolvedValue(ok("hecho"));
    vi.stubGlobal("fetch", f);
    await preguntar(propia, { texto: "hola", sistema: "sé breve" });
    assert.equal(f.mock.calls[0][0], "https://x.test/v1");
    assert.equal(f.mock.calls[0][1].headers.authorization, "Bearer k");
    assert.equal(JSON.parse(f.mock.calls[0][1].body).messages.length, 2);
  });
  it("reintenta sin modo JSON si el modelo del usuario no lo admite", async () => {
    const f = vi.fn().mockResolvedValueOnce(estado(400)).mockResolvedValueOnce(ok("{}"));
    vi.stubGlobal("fetch", f);
    assert.equal(await preguntar(propia, { texto: "x", json: true }), "{}");
    assert.equal(JSON.parse(f.mock.calls[1][1].body).response_format, undefined);
  });
  it("traduce los errores a códigos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(estado(429)));
    await assert.rejects(preguntar(app, { texto: "x" }), (e: ErrorIa) => e.codigo === "cupo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(estado(401)));
    await assert.rejects(preguntar(propia, { texto: "x" }), (e: ErrorIa) => e.codigo === "clave");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("red")));
    await assert.rejects(preguntar(app, { texto: "x" }), (e: ErrorIa) => e.codigo === "caida");
  });
  it("avisa si faltan datos de la IA propia", async () => {
    await assert.rejects(
      preguntar({ id: "ajustes", modoIa: "propia" }, { texto: "x" }),
      (e: ErrorIa) => e.codigo === "config",
    );
  });
});
