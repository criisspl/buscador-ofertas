import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import {
  proveedorDe,
  ProveedorApp,
  ProveedorDemo,
  ProveedorPropio,
} from "../src/lib/ia/proveedores.ts";
import { ErrorIa } from "../src/lib/ia/tipos.ts";

const ok = (texto = "hola") =>
  new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

const base = {
  id: "ajustes",
  almacenamiento: "dexie",
  proveedorIa: "otro",
  configurado: true,
} as const;

describe("proveedorDe", () => {
  it("elige la implementación según el modo de los ajustes", () => {
    assert.ok(proveedorDe({ ...base, modoIa: "app" }) instanceof ProveedorApp);
    assert.ok(proveedorDe({ ...base, modoIa: "propia" }) instanceof ProveedorPropio);
    assert.ok(proveedorDe({ ...base, modoIa: "demo" }) instanceof ProveedorDemo);
    for (const modoIa of ["app", "propia", "demo"] as const)
      assert.equal(proveedorDe({ ...base, modoIa }).modo, modoIa);
  });
});

describe("ProveedorApp", () => {
  it("llama a /api/ia sin clave y pide JSON con `json: true`", async () => {
    const f = vi.fn().mockResolvedValue(ok("{}"));
    vi.stubGlobal("fetch", f);
    await new ProveedorApp().preguntar({ sistema: "s", texto: "t", json: true });
    const [url, init] = f.mock.calls[0];
    assert.equal(url, "/api/ia");
    assert.equal(init.headers.authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), {
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "t" },
      ],
      json: true,
    });
  });
});

describe("ProveedorPropio", () => {
  const ajustes = { url: "https://u.test/v1/chat/completions", modelo: "m", clave: "sk-1" };

  it("llama directo al proveedor con la clave del usuario", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", f);
    assert.equal(await new ProveedorPropio(ajustes).preguntar({ texto: "t", json: true }), "hola");
    const [url, init] = f.mock.calls[0];
    assert.equal(url, ajustes.url);
    assert.equal(init.headers.authorization, "Bearer sk-1");
    const cuerpo = JSON.parse(init.body);
    assert.equal(cuerpo.model, "m");
    assert.deepEqual(cuerpo.response_format, { type: "json_object" });
  });

  it("rechaza (no lanza en seco) si faltan datos", async () => {
    await assert.rejects(
      new ProveedorPropio({ url: "https://u.test" }).preguntar({ texto: "t" }),
      (e: unknown) => e instanceof ErrorIa && e.codigo === "config",
    );
  });
});

describe("ProveedorPropio: destino y clave", () => {
  const f = () => {
    const m = vi.fn().mockImplementation(async () => ok());
    vi.stubGlobal("fetch", m);
    return m;
  };
  const rechaza = (url: string, clave?: string) =>
    new ProveedorPropio({ url, modelo: "m", clave }).preguntar({ texto: "t" });

  it("nunca manda la clave por http fuera de tu equipo", async () => {
    const m = f();
    await assert.rejects(rechaza("http://api.ejemplo.com/v1", "sk-1"), /https/);
    await assert.rejects(rechaza("https://usuario:pass@api.ejemplo.com/v1", "sk-1"), /usuario/);
    assert.equal(m.mock.calls.length, 0);
  });
  it("Ollama en local funciona sin clave y sin cabecera de autorización", async () => {
    const m = f();
    await new ProveedorPropio({
      url: "http://localhost:11434/v1/chat/completions",
      modelo: "m",
    }).preguntar({ texto: "t" });
    assert.equal(m.mock.calls[0][1].headers.authorization, undefined);
  });
  it("fuera de tu equipo sin clave (bloqueada) pide desbloquearla", async () => {
    await assert.rejects(rechaza("https://u.test/v1"), /desbloquéala/);
  });
  it("proveedorDe usa la clave descifrada y, si no, la heredada", async () => {
    const m = f();
    const a = {
      ...base,
      modoIa: "propia",
      url: "https://u.test/v1",
      modelo: "m",
      clave: "heredada",
    } as const;
    await proveedorDe(a, "descifrada").preguntar({ texto: "t" });
    await proveedorDe(a).preguntar({ texto: "t" });
    assert.equal(m.mock.calls[0][1].headers.authorization, "Bearer descifrada");
    assert.equal(m.mock.calls[1][1].headers.authorization, "Bearer heredada");
  });
});

describe("ProveedorDemo", () => {
  it("responde sin red", async () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("no debería haber red");
    });
    assert.equal(typeof (await new ProveedorDemo().preguntar({ texto: "x" })), "string");
  });
});
