import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";
import { exportar, importar } from "../src/lib/candidaturas.ts";
import { instantanea, restaurar } from "../src/lib/copia.ts";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import type { Candidatura, Oferta } from "../src/lib/tipos.ts";

let db: BaseDatos;
let almacen: AlmacenDexie;
beforeEach(async () => {
  db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
  almacen = new AlmacenDexie(db);
});

const aMano: Oferta = {
  id: "mano:1",
  fuente: "manual",
  idExterno: "mano:1",
  titulo: "Dev",
  empresa: "Acme",
  ubicacion: "",
  url: "",
  descripcion: "Algo",
};
const cand: Candidatura = {
  ofertaId: "mano:1",
  estado: "guardada",
  carta: "",
  notas: "",
  creada: 1,
  actualizada: 1,
};

describe("copia con oferta a mano (url vacía)", () => {
  it("exportar e importar candidaturas conserva la oferta", async () => {
    await db.ofertas.put(aMano);
    await db.candidaturas.put(cand);
    const texto = await exportar(almacen);
    const otra = new BaseDatos(`test-${Math.random()}`);
    await otra.open();
    assert.equal(await importar(new AlmacenDexie(otra), texto), 1);
    assert.deepEqual(await otra.ofertas.get("mano:1"), aMano);
    assert.deepEqual(await otra.candidaturas.get("mano:1"), cand);
  });

  it("instantánea y restaurar dan la vuelta completa", async () => {
    await db.ofertas.put(aMano);
    await db.candidaturas.put(cand);
    const texto = await instantanea(almacen);
    const otra = new BaseDatos(`test-${Math.random()}`);
    await otra.open();
    await restaurar(new AlmacenDexie(otra), texto);
    assert.deepEqual(await otra.ofertas.toArray(), [aMano]);
    assert.deepEqual(await otra.candidaturas.toArray(), [cand]);
  });
});

describe("restaurar", () => {
  it("rechaza datos malformados sin tocar nada", async () => {
    const mala = JSON.stringify({
      version: 1,
      ofertas: [{ ...aMano, url: "javascript:alert(1)" }],
      encajes: [],
      candidaturas: [{ ...cand, estado: "inventado" }],
    });
    await assert.rejects(restaurar(almacen, mala), /formato esperado/);
    assert.equal(await db.ofertas.count(), 0);
    assert.equal(await db.candidaturas.count(), 0);
  });

  it("rechaza un perfil con forma incorrecta y un JSON roto", async () => {
    const mala = JSON.stringify({
      version: 1,
      perfil: { id: "perfil", skills: "js" },
      ofertas: [],
      encajes: [],
      candidaturas: [],
    });
    await assert.rejects(restaurar(almacen, mala), /perfil/);
    await assert.rejects(restaurar(almacen, "{no json"), /JSON válido/);
  });
});
