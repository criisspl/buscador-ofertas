import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import Dexie from "dexie";
import { describe, it } from "vitest";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import { AjustesSchema } from "../src/lib/esquemas.ts";
import { PRESETS } from "../src/lib/ia/presets.ts";

/** Crea una base como la dejaba la versión 1 de la app (antes de los ajustes configurables). */
async function baseV1(nombre: string, ajustes?: object) {
  const v1 = new Dexie(nombre);
  v1.version(1).stores({
    ajustes: "id",
    perfil: "id",
    preferencias: "id",
    ofertas: "id, fuente",
    encajes: "ofertaId, nota",
    candidaturas: "ofertaId, estado, actualizada",
  });
  await v1.open();
  if (ajustes) await v1.table("ajustes").put(ajustes);
  await v1.table("perfil").put({
    id: "perfil",
    skills: ["React"],
    experiencia: [],
    idiomas: [],
    textoCv: "cv",
  });
  await v1.table("candidaturas").put({
    ofertaId: "a:1",
    estado: "enviada",
    carta: "c",
    notas: "n",
    creada: 1,
    actualizada: 2,
  });
  v1.close();
}

describe("migración de la base a la versión 2", () => {
  it("conserva ajustes y datos de quien ya usaba clave propia, sin pasos manuales", async () => {
    const nombre = `mig-${Math.random()}`;
    await baseV1(nombre, {
      id: "ajustes",
      modoIa: "propia",
      url: PRESETS.openai.url,
      modelo: "gpt-4o",
      clave: "sk-antigua",
    });

    const almacen = new AlmacenDexie(new BaseDatos(nombre));
    const aj = await almacen.leerAjustes();
    assert.equal(aj?.modoIa, "propia");
    assert.equal(aj?.url, PRESETS.openai.url);
    assert.equal(aj?.modelo, "gpt-4o");
    assert.equal(aj?.clave, "sk-antigua", "la clave sigue funcionando hasta que se proteja");
    assert.equal(aj?.almacenamiento, "dexie");
    assert.equal(aj?.proveedorIa, "openai");
    assert.equal(aj?.configurado, true, "no se le vuelve a pedir el asistente");
    assert.ok(AjustesSchema.safeParse(aj).success);

    assert.deepEqual((await almacen.leerPerfil())?.skills, ["React"]);
    assert.equal((await almacen.obtenerCandidatura("a:1"))?.estado, "enviada");
  });

  it("quien usaba la IA de la app sigue igual", async () => {
    const nombre = `mig-${Math.random()}`;
    await baseV1(nombre, { id: "ajustes", modoIa: "app" });
    const aj = await new AlmacenDexie(new BaseDatos(nombre)).leerAjustes();
    assert.equal(aj?.modoIa, "app");
    assert.equal(aj?.configurado, true);
    assert.equal(aj?.proveedorIa, "otro");
  });

  it("una URL propia que no es de un predefinido queda como «otro»", async () => {
    const nombre = `mig-${Math.random()}`;
    await baseV1(nombre, {
      id: "ajustes",
      modoIa: "propia",
      url: "https://x.test/v1",
      modelo: "m",
    });
    const aj = await new AlmacenDexie(new BaseDatos(nombre)).leerAjustes();
    assert.equal(aj?.proveedorIa, "otro");
    assert.equal(aj?.url, "https://x.test/v1");
  });

  it("sin ajustes previos no inventa ninguno: el asistente se mostrará", async () => {
    const nombre = `mig-${Math.random()}`;
    await baseV1(nombre);
    const almacen = new AlmacenDexie(new BaseDatos(nombre));
    assert.equal(await almacen.leerAjustes(), undefined);
    assert.equal((await almacen.leerPerfil())?.textoCv, "cv");
  });

  it("una base nueva se crea ya en la versión 2", async () => {
    const db = new BaseDatos(`mig-${Math.random()}`);
    await db.open();
    assert.equal(db.verno, 2);
  });
});
