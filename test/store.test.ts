import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";
import { BaseDatos, borrarOfertasNoGuardadas } from "../src/lib/store.ts";

let db: BaseDatos;
beforeEach(async () => {
  db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
});

describe("store", () => {
  it("guarda y lee una candidatura por oferta", async () => {
    await db.candidaturas.put({
      ofertaId: "adzuna:1",
      estado: "guardada",
      carta: "",
      notas: "",
      creada: 1,
      actualizada: 1,
    });
    const c = await db.candidaturas.get("adzuna:1");
    assert.equal(c?.estado, "guardada");
  });

  it("deduplica ofertas con el mismo id", async () => {
    const base = {
      fuente: "adzuna",
      idExterno: "1",
      titulo: "Dev",
      empresa: "X",
      ubicacion: "Madrid",
      url: "https://x.test",
      descripcion: "",
    };
    await db.ofertas.put({ id: "adzuna:1", ...base });
    await db.ofertas.put({ id: "adzuna:1", ...base, titulo: "Dev senior" });
    assert.equal(await db.ofertas.count(), 1);
    assert.equal((await db.ofertas.get("adzuna:1"))?.titulo, "Dev senior");
  });
});

describe("borrarOfertasNoGuardadas", () => {
  const oferta = (id: string) => ({
    id,
    fuente: "adzuna",
    idExterno: id,
    titulo: id,
    empresa: "X",
    ubicacion: "Madrid",
    url: "https://x.test",
    descripcion: "",
  });
  const encaje = (ofertaId: string) => ({
    ofertaId,
    nota: 50,
    cumple: [],
    falta: [],
    proveedor: "test",
  });

  it("borra solo las no guardadas y sus encajes, y devuelve el recuento", async () => {
    await db.ofertas.bulkPut([oferta("a"), oferta("b"), oferta("c")]);
    await db.encajes.bulkPut([encaje("a"), encaje("b"), encaje("c")]);
    await db.candidaturas.put({
      ofertaId: "b",
      estado: "guardada",
      carta: "",
      notas: "",
      creada: 1,
      actualizada: 1,
    });
    assert.equal(await borrarOfertasNoGuardadas(db), 2);
    assert.deepEqual(await db.ofertas.toCollection().primaryKeys(), ["b"]);
    assert.deepEqual(await db.encajes.toCollection().primaryKeys(), ["b"]);
    assert.equal(await db.candidaturas.count(), 1);
  });

  it("devuelve 0 si no hay nada que borrar", async () => {
    assert.equal(await borrarOfertasNoGuardadas(db), 0);
  });

  it("no toca el esquema", async () => {
    await borrarOfertasNoGuardadas(db);
    assert.equal(db.verno, 1);
    assert.deepEqual(db.tables.map((t) => t.name).sort(), [
      "ajustes",
      "candidaturas",
      "encajes",
      "ofertas",
      "perfil",
      "preferencias",
    ]);
  });
});
