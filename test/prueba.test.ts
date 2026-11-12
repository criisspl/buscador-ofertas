import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { ErrorIa } from "../src/lib/ia/cliente.ts";
import type { ProveedorIa } from "../src/lib/ia/tipos.ts";
import { probarConexion } from "../src/lib/ia/prueba.ts";
import type { Ajustes } from "../src/lib/tipos.ts";

const base = {
  id: "ajustes",
  almacenamiento: "dexie",
  proveedorIa: "otro",
  configurado: true,
} as const;
const propia = (parcial: Partial<Ajustes> = {}): Ajustes => ({
  ...base,
  modoIa: "propia",
  url: "https://api.ejemplo.com/v1/chat/completions",
  modelo: "m",
  clave: "k",
  ...parcial,
});
const falla = (codigo: ErrorIa["codigo"], m = "x") =>
  vi.fn().mockRejectedValue(new ErrorIa(codigo, m));

const prueba = (a: Ajustes, p: ProveedorIa["preguntar"], clave?: string) =>
  probarConexion(a, clave, { modo: a.modoIa, preguntar: p });

describe("probarConexion", () => {
  it("da por buena una IA que responde", async () => {
    const p = vi.fn().mockResolvedValue("ok");
    assert.equal((await prueba(propia(), p)).ok, true);
    assert.equal(p.mock.calls.length, 1);
  });

  it("no hace red en modo demo", async () => {
    const p = vi.fn();
    const r = await prueba({ ...base, modoIa: "demo" }, p);
    assert.equal(r.ok, true);
    assert.equal(p.mock.calls.length, 0);
  });

  it("detecta datos incompletos, URL rara y http fuera de local sin llamar a la IA", async () => {
    const p = vi.fn();
    for (const a of [
      propia({ clave: "" }),
      propia({ url: "esto no es una url" }),
      propia({ url: "http://api.ejemplo.com/v1" }),
    ])
      assert.equal((await prueba(a, p)).ok, false);
    assert.equal(p.mock.calls.length, 0);
  });

  it("acepta http en localhost (Ollama)", async () => {
    const p = vi.fn().mockResolvedValue("ok");
    assert.equal(
      (await prueba(propia({ url: "http://localhost:11434/v1/chat/completions" }), p)).ok,
      true,
    );
  });

  it("explica cada tipo de fallo", async () => {
    const m = async (c: ErrorIa["codigo"], a = propia()) => (await prueba(a, falla(c))).mensaje;
    assert.match(await m("clave"), /clave no es válida/);
    assert.match(await m("cupo"), /cupo/);
    assert.match(await m("cupo", { ...base, modoIa: "app" }), /propia clave/);
    assert.match(await m("formato"), /modelo/);
    assert.match(await m("caida"), /CORS/);
  });

  it("no se traga errores que no son de la IA", async () => {
    await assert.rejects(prueba(propia(), vi.fn().mockRejectedValue(new Error("bug"))), /bug/);
  });
});
