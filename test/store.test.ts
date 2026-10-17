import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";
import { BaseDatos } from "../src/lib/store.ts";

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
