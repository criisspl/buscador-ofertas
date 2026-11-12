import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import type { Almacenamiento } from "../src/lib/almacen/tipos.ts";
import type { Candidatura, Encaje, Oferta } from "../src/lib/tipos.ts";

const oferta = (id: string, titulo = id): Oferta => ({
  id,
  fuente: "adzuna",
  idExterno: id,
  titulo,
  empresa: "X",
  ubicacion: "Madrid",
  url: "https://x.test",
  descripcion: "",
});
const encaje = (ofertaId: string): Encaje => ({
  ofertaId,
  nota: 50,
  cumple: [],
  falta: [],
  proveedor: "test",
});
const candidatura = (ofertaId: string, actualizada = 1): Candidatura => ({
  ofertaId,
  estado: "guardada",
  carta: "",
  notas: "",
  creada: 1,
  actualizada,
});

/**
 * Contrato que tiene que cumplir cualquier `Almacenamiento`. Cuando haya otro adaptador
 * (nube, BBDD propia), se pasa por aquí con su propia fábrica.
 */
function contratoAlmacenamiento(nombre: string, crear: () => Promise<Almacenamiento>) {
  describe(`contrato de Almacenamiento: ${nombre}`, () => {
    let a: Almacenamiento;
    beforeEach(async () => {
      a = await crear();
    });

    it("sin datos todo viene vacío", async () => {
      assert.equal(await a.leerAjustes(), undefined);
      assert.equal(await a.leerPerfil(), undefined);
      assert.equal(await a.leerPreferencias(), undefined);
      assert.deepEqual(await a.listarOfertas(), []);
      assert.deepEqual(await a.listarEncajes(), []);
      assert.deepEqual(await a.listarCandidaturas(), []);
      assert.deepEqual(await a.idsCandidaturas(), []);
      assert.equal(await a.hayDatos(), false);
    });

    it("guarda y lee ajustes, perfil y preferencias", async () => {
      const ajustes = {
        id: "ajustes",
        modoIa: "propia",
        url: "https://u.test",
        modelo: "m",
      } as const;
      const perfil = {
        id: "perfil" as const,
        skills: ["React"],
        experiencia: [],
        idiomas: [],
        textoCv: "",
      };
      const prefs = {
        id: "preferencias",
        puestos: ["Frontend"],
        ubicacion: "Madrid",
        remoto: true,
        sectoresEvitar: [],
      } as const;
      await a.guardarAjustes({ ...ajustes });
      await a.guardarPerfil(perfil);
      await a.guardarPreferencias({ ...prefs, puestos: ["Frontend"], sectoresEvitar: [] });
      assert.deepEqual(await a.leerAjustes(), ajustes);
      assert.equal((await a.leerPerfil())?.skills[0], "React");
      assert.equal((await a.leerPreferencias())?.ubicacion, "Madrid");
    });

    it("guardar sustituye por clave: no hay duplicados", async () => {
      await a.guardarOferta(oferta("adzuna:1", "Dev"));
      await a.guardarOferta(oferta("adzuna:1", "Dev senior"));
      await a.guardarOfertas([oferta("adzuna:2"), oferta("adzuna:2", "Otra")]);
      const todas = await a.listarOfertas();
      assert.equal(todas.length, 2);
      assert.equal(todas.find((o) => o.id === "adzuna:1")?.titulo, "Dev senior");
    });

    it("obtenerOfertas y obtenerEncajes respetan el orden y dejan huecos", async () => {
      await a.guardarOfertas([oferta("a"), oferta("b")]);
      await a.guardarEncaje(encaje("b"));
      assert.deepEqual(
        (await a.obtenerOfertas(["b", "x", "a"])).map((o) => o?.id),
        ["b", undefined, "a"],
      );
      assert.deepEqual(
        (await a.obtenerEncajes(["a", "b"])).map((e) => e?.ofertaId),
        [undefined, "b"],
      );
    });

    it("candidaturas: guardar, leer, actualizar, borrar y ordenar por recientes", async () => {
      await a.guardarCandidatura(candidatura("a", 1));
      await a.guardarCandidatura(candidatura("b", 3));
      await a.guardarCandidatura(candidatura("c", 2));
      assert.deepEqual(await a.idsCandidaturas(), ["a", "b", "c"]);
      assert.deepEqual(
        (await a.listarCandidaturas()).map((c) => c.ofertaId),
        ["a", "b", "c"],
      );
      assert.deepEqual(
        (await a.listarCandidaturasRecientes()).map((c) => c.ofertaId),
        ["b", "c", "a"],
      );
      await a.actualizarCandidatura("a", { estado: "enviada", actualizada: 9 });
      const actual = await a.obtenerCandidatura("a");
      assert.equal(actual?.estado, "enviada");
      assert.equal(actual?.notas, "");
      assert.equal((await a.listarCandidaturasRecientes())[0].ofertaId, "a");
      await a.actualizarCandidatura("no-existe", { estado: "enviada" });
      assert.equal(await a.obtenerCandidatura("no-existe"), undefined);
      await a.borrarCandidatura("a");
      assert.equal(await a.obtenerCandidatura("a"), undefined);
    });

    it("hayDatos cuenta perfil o candidaturas, no ofertas", async () => {
      await a.guardarOferta(oferta("a"));
      assert.equal(await a.hayDatos(), false);
      await a.guardarCandidatura(candidatura("a"));
      assert.equal(await a.hayDatos(), true);
    });

    it("borrarOfertasNoGuardadas borra solo las no guardadas y sus encajes", async () => {
      await a.guardarOfertas([oferta("a"), oferta("b"), oferta("c")]);
      for (const id of ["a", "b", "c"]) await a.guardarEncaje(encaje(id));
      await a.guardarCandidatura(candidatura("b"));
      assert.equal(await a.borrarOfertasNoGuardadas(), 2);
      assert.deepEqual(
        (await a.listarOfertas()).map((o) => o.id),
        ["b"],
      );
      assert.deepEqual(
        (await a.listarEncajes()).map((e) => e.ofertaId),
        ["b"],
      );
      assert.equal((await a.listarCandidaturas()).length, 1);
      assert.equal(await a.borrarOfertasNoGuardadas(), 0);
    });

    it("escribirLote guarda todo lo que se da y deja el resto como estaba", async () => {
      await a.guardarAjustes({ id: "ajustes", modoIa: "demo" });
      await a.escribirLote({
        ofertas: [oferta("a")],
        encajes: [encaje("a")],
        candidaturas: [candidatura("a")],
      });
      assert.equal((await a.leerAjustes())?.modoIa, "demo");
      assert.equal((await a.listarOfertas()).length, 1);
      assert.equal((await a.listarEncajes()).length, 1);
      assert.equal((await a.listarCandidaturas()).length, 1);
    });

    it("escribirLote es atómico: si algo falla no entra nada", async () => {
      const mala = { ...oferta("mala"), id: undefined } as unknown as Oferta;
      await assert.rejects(
        a.escribirLote({ ofertas: [oferta("a"), mala], candidaturas: [candidatura("a")] }),
      );
      assert.deepEqual(await a.listarOfertas(), []);
      assert.deepEqual(await a.listarCandidaturas(), []);
    });

    it("leerDatos devuelve todo menos los ajustes", async () => {
      await a.guardarAjustes({ id: "ajustes", modoIa: "propia", clave: "sk-secreta" });
      await a.escribirLote({ ofertas: [oferta("a")], candidaturas: [candidatura("a")] });
      const datos = await a.leerDatos();
      assert.equal(datos.ofertas.length, 1);
      assert.equal(datos.candidaturas.length, 1);
      assert.deepEqual(datos.encajes, []);
      assert.equal(datos.perfil, undefined);
      assert.ok(!JSON.stringify(datos).includes("sk-secreta"));
    });

    it("observar avisa al empezar y cada vez que cambian los datos, y se puede cancelar", async () => {
      const alCambiar = vi.fn();
      const cancelar = a.observar(() => a.listarOfertas(), alCambiar);
      await vi.waitFor(() => assert.deepEqual(alCambiar.mock.lastCall?.[0], []));
      await a.guardarOferta(oferta("a"));
      await vi.waitFor(() => assert.equal(alCambiar.mock.lastCall?.[0].length, 1));
      cancelar();
      const llamadas = alCambiar.mock.calls.length;
      await a.guardarOferta(oferta("b"));
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(alCambiar.mock.calls.length, llamadas);
    });

    it("observar no propaga los fallos de lectura", async () => {
      const alCambiar = vi.fn();
      const cancelar = a.observar(() => Promise.reject(new Error("roto")), alCambiar);
      await new Promise((r) => setTimeout(r, 50));
      cancelar();
      assert.equal(alCambiar.mock.calls.length, 0);
    });
  });
}

const bases: BaseDatos[] = [];
afterEach(async () => {
  await Promise.all(bases.splice(0).map((b) => b.delete()));
});

contratoAlmacenamiento("Dexie (IndexedDB)", async () => {
  const base = new BaseDatos(`test-${Math.random()}`);
  bases.push(base);
  await base.open();
  return new AlmacenDexie(base);
});

describe("AlmacenDexie: esquema", () => {
  it("no toca el esquema: versión 1 y las mismas tablas", async () => {
    const base = new BaseDatos(`test-${Math.random()}`);
    bases.push(base);
    await new AlmacenDexie(base).borrarOfertasNoGuardadas();
    assert.equal(base.verno, 1);
    assert.deepEqual(base.tables.map((t) => t.name).sort(), [
      "ajustes",
      "candidaturas",
      "encajes",
      "ofertas",
      "perfil",
      "preferencias",
    ]);
  });
});
