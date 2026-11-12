import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";
import { cargarDemo, OFERTAS_DEMO } from "../src/lib/demo-datos.ts";
import { perfilDesdeCv } from "../src/lib/cv/perfil.ts";
import { cartaPara } from "../src/lib/candidaturas.ts";
import { puntuar } from "../src/lib/encaje.ts";
import { preguntar } from "../src/lib/ia/cliente.ts";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";

let db: BaseDatos;
let almacen: AlmacenDexie;
beforeEach(async () => {
  db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
  almacen = new AlmacenDexie(db);
});

describe("modo demo", () => {
  it("carga los datos de ejemplo y activa la IA demo", async () => {
    assert.equal(await almacen.hayDatos(), false);
    await cargarDemo(almacen);
    assert.equal(await almacen.hayDatos(), true);
    assert.equal((await db.ajustes.get("ajustes"))?.modoIa, "demo");
    assert.equal(await db.ofertas.count(), OFERTAS_DEMO.length);
  });

  it("no hace ninguna petición de red", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("no debería haber red");
    }) as typeof fetch;
    try {
      await cargarDemo(almacen);
      const aj = (await db.ajustes.get("ajustes"))!;
      const perfil = await perfilDesdeCv("cualquier texto", aj);
      assert.ok(perfil.skills.length > 0);
      const carta = await cartaPara(OFERTAS_DEMO[0], perfil, aj);
      assert.match(carta, /modo demo/);
      assert.equal(typeof (await preguntar(aj, { texto: "x" })), "string");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("puntúa distinto según lo que pide cada oferta", async () => {
    await cargarDemo(almacen);
    const aj = (await db.ajustes.get("ajustes"))!;
    const perfil = (await db.perfil.get("perfil"))!;
    const prefs = (await db.preferencias.get("preferencias"))!;
    const notas = await Promise.all(OFERTAS_DEMO.map((o) => puntuar(o, perfil, prefs, aj)));
    const porId = Object.fromEntries(notas.map((e) => [e.ofertaId, e]));
    assert.ok(
      porId["demo:6"].nota > porId["demo:2"].nota,
      "la de React/TS/Node puntúa más que la de Angular",
    );
    assert.ok(porId["demo:4"].nota < 40, "la de Java/AWS puntúa bajo");
    assert.ok(porId["demo:2"].falta.some((f) => /Angular/.test(f)));
    for (const e of notas) assert.ok(e.nota >= 0 && e.nota <= 100);
  });
});
