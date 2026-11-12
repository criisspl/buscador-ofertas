import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import type { Almacenamiento } from "../src/lib/almacen/tipos.ts";
import { crearConsulta } from "../src/lib/useConsulta.ts";

let db: BaseDatos;
let almacen: AlmacenDexie;
beforeEach(async () => {
  db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
  almacen = new AlmacenDexie(db);
});
afterEach(() => db.delete());

const oferta = {
  id: "a",
  fuente: "manual" as const,
  idExterno: "a",
  titulo: "Dev",
  empresa: "X",
  ubicacion: "",
  url: "",
  descripcion: "",
};

describe("crearConsulta", () => {
  it("vale undefined al principio y emite el valor al cargar", async () => {
    const c = crearConsulta(almacen, (a) => a.listarOfertas().then((l) => l.length));
    assert.equal(c.getSnapshot(), undefined);
    const baja = c.subscribe(() => {});
    await vi.waitFor(() => assert.equal(c.getSnapshot(), 0));
    baja();
  });

  it("se actualiza al cambiar los datos, avisa y el snapshot es estable", async () => {
    const c = crearConsulta(almacen, (a) => a.listarOfertas());
    const avisar = vi.fn();
    const baja = c.subscribe(avisar);
    await vi.waitFor(() => assert.deepEqual(c.getSnapshot(), []));
    const antes = c.getSnapshot();
    assert.equal(c.getSnapshot(), antes);
    await db.ofertas.put(oferta);
    await vi.waitFor(() => assert.equal(c.getSnapshot()?.length, 1));
    assert.ok(avisar.mock.calls.length >= 2);
    baja();
  });

  it("deja de escuchar al darse de baja el último", async () => {
    const consulta = vi.fn((a: Almacenamiento) => a.listarOfertas().then((l) => l.length));
    const c = crearConsulta(almacen, consulta);
    const baja = c.subscribe(() => {});
    await vi.waitFor(() => assert.equal(consulta.mock.calls.length, 1));
    baja();
    await db.ofertas.put(oferta);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(consulta.mock.calls.length, 1);
  });
});
