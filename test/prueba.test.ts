import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { ErrorIa } from "../src/lib/ia/cliente.ts";
import { probarConexion } from "../src/lib/ia/prueba.ts";
import type { Ajustes } from "../src/lib/tipos.ts";

const propia = (parcial: Partial<Ajustes> = {}): Ajustes => ({
  id: "ajustes",
  modoIa: "propia",
  url: "https://api.ejemplo.com/v1/chat/completions",
  modelo: "m",
  clave: "k",
  ...parcial,
});
const falla = (codigo: ErrorIa["codigo"], m = "x") =>
  vi.fn().mockRejectedValue(new ErrorIa(codigo, m));

describe("probarConexion", () => {
  it("da por buena una IA que responde", async () => {
    const p = vi.fn().mockResolvedValue("ok");
    assert.equal((await probarConexion(propia(), p)).ok, true);
    assert.equal(p.mock.calls.length, 1);
  });

  it("no hace red en modo demo", async () => {
    const p = vi.fn();
    const r = await probarConexion({ id: "ajustes", modoIa: "demo" }, p);
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
      assert.equal((await probarConexion(a, p)).ok, false);
    assert.equal(p.mock.calls.length, 0);
  });

  it("acepta http en localhost (Ollama)", async () => {
    const p = vi.fn().mockResolvedValue("ok");
    assert.equal(
      (await probarConexion(propia({ url: "http://localhost:11434/v1/chat/completions" }), p)).ok,
      true,
    );
  });

  it("explica cada tipo de fallo", async () => {
    const m = async (c: ErrorIa["codigo"], a = propia()) =>
      (await probarConexion(a, falla(c))).mensaje;
    assert.match(await m("clave"), /clave no es válida/);
    assert.match(await m("cupo"), /cupo/);
    assert.match(await m("cupo", { id: "ajustes", modoIa: "app" }), /propia clave/);
    assert.match(await m("formato"), /modelo/);
    assert.match(await m("caida"), /CORS/);
  });

  it("no se traga errores que no son de la IA", async () => {
    await assert.rejects(
      probarConexion(propia(), vi.fn().mockRejectedValue(new Error("bug"))),
      /bug/,
    );
  });
});
