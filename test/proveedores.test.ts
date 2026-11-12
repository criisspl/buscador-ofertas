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

describe("proveedorDe", () => {
  it("elige la implementación según el modo de los ajustes", () => {
    assert.ok(proveedorDe({ id: "ajustes", modoIa: "app" }) instanceof ProveedorApp);
    assert.ok(proveedorDe({ id: "ajustes", modoIa: "propia" }) instanceof ProveedorPropio);
    assert.ok(proveedorDe({ id: "ajustes", modoIa: "demo" }) instanceof ProveedorDemo);
    for (const modoIa of ["app", "propia", "demo"] as const)
      assert.equal(proveedorDe({ id: "ajustes", modoIa }).modo, modoIa);
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

describe("ProveedorDemo", () => {
  it("responde sin red", async () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("no debería haber red");
    });
    assert.equal(typeof (await new ProveedorDemo().preguntar({ texto: "x" })), "string");
  });
});
