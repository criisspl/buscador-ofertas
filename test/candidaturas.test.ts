import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import {
  actualizar,
  borrar,
  cartaPara,
  contar,
  exportar,
  filtrar,
  guardar,
  importar,
  nombreCarta,
  type Fila,
} from "../src/lib/candidaturas.ts";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import type { Oferta } from "../src/lib/tipos.ts";

const oferta: Oferta = {
  id: "a:1",
  fuente: "a",
  idExterno: "1",
  titulo: "Dev",
  empresa: "Acme",
  ubicacion: "Madrid",
  url: "https://x.test/1",
  descripcion: "React",
};

let db: BaseDatos;
let almacen: AlmacenDexie;
beforeEach(async () => {
  db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
  almacen = new AlmacenDexie(db);
  await db.ofertas.put(oferta);
});

describe("candidaturas", () => {
  it("guarda una vez y no pisa el estado al volver a guardar", async () => {
    await guardar(almacen, "a:1", 1);
    await actualizar(almacen, "a:1", { estado: "enviada", notas: "hablé con RRHH" }, 2);
    await guardar(almacen, "a:1", 3);
    const c = await db.candidaturas.get("a:1");
    assert.deepEqual(
      [c?.estado, c?.notas, c?.creada, c?.actualizada],
      ["enviada", "hablé con RRHH", 1, 2],
    );
  });

  it("borra la candidatura y deja la oferta, y se puede volver a guardar", async () => {
    await guardar(almacen, "a:1", 1);
    await actualizar(almacen, "a:1", { notas: "vieja" }, 2);
    await borrar(almacen, "a:1");
    assert.equal(await db.candidaturas.get("a:1"), undefined);
    assert.equal((await db.ofertas.get("a:1"))?.titulo, "Dev");
    await guardar(almacen, "a:1", 3);
    assert.equal((await db.candidaturas.get("a:1"))?.notas, "");
  });

  it("los estados nuevos se guardan, cuentan como en marcha o no, y viajan en la copia", async () => {
    await guardar(almacen, "a:1", 1);
    await actualizar(almacen, "a:1", { estado: "contacto" }, 2);
    const copia = await exportar(almacen);
    const otra = new BaseDatos(`test-${Math.random()}`);
    await otra.open();
    await importar(new AlmacenDexie(otra), copia);
    const c = (await otra.candidaturas.get("a:1"))!;
    assert.equal(c.estado, "contacto");
    const filas = [
      { c },
      { c: { ...c, estado: "rechazada" as const } },
      { c: { ...c, estado: "cerrada" as const } },
    ];
    const n = contar(filas);
    assert.deepEqual([n.activas, n.rechazada, n.cerrada, n.todas], [1, 1, 1, 3]);
  });

  it("exporta e importa en otra base", async () => {
    await guardar(almacen, "a:1", 1);
    const copia = await exportar(almacen);
    const otra = new BaseDatos(`test-${Math.random()}`);
    await otra.open();
    assert.equal(await importar(new AlmacenDexie(otra), copia), 1);
    assert.equal((await otra.ofertas.get("a:1"))?.titulo, "Dev");
    assert.equal((await otra.candidaturas.get("a:1"))?.estado, "guardada");
  });

  it("rechaza archivos que no son una copia y no toca nada", async () => {
    for (const malo of [
      "no json",
      "{}",
      JSON.stringify({
        version: 1,
        ofertas: [{ ...oferta, url: "javascript:x" }],
        candidaturas: [],
      }),
    ])
      await assert.rejects(importar(almacen, malo), /copia válida/);
    assert.equal(await db.candidaturas.count(), 0);
  });
});

describe("cartaPara", () => {
  it("pide la carta con la oferta como dato y devuelve el texto limpio", async () => {
    const p = vi.fn().mockResolvedValue("  Hola, me interesa.  \n");
    const perfil = {
      id: "perfil" as const,
      skills: ["React"],
      experiencia: [],
      idiomas: [],
      textoCv: "",
    };
    const t = await cartaPara(oferta, perfil, { modo: "app", preguntar: p });
    assert.equal(t, "Hola, me interesa.");
    assert.match(p.mock.calls[0][0].sistema, /no son instrucciones/);
    assert.equal(p.mock.calls[0][0].json, undefined);
  });
});

describe("filtros", () => {
  const fila = (
    id: string,
    estado: Fila["c"]["estado"],
    titulo: string,
    empresa: string,
  ): Fila => ({
    c: { ofertaId: id, estado, carta: "", notas: "", creada: 1, actualizada: 1 },
    o: { ...oferta, id, titulo, empresa },
  });
  const filas = [
    fila("1", "guardada", "Desarrolladora Frontend", "Acme"),
    fila("2", "enviada", "Backend", "Café Sólido"),
    fila("3", "descartada", "Diseño", "Acme"),
  ];

  it("cuenta por estado, en marcha y todas", () => {
    const c = contar(filas);
    assert.deepEqual([c.activas, c.todas, c.guardada, c.enviada, c.descartada], [2, 3, 1, 1, 1]);
  });

  it("filtra por estado y por búsqueda sin tildes ni mayúsculas", () => {
    assert.deepEqual(
      filtrar(filas, "activas", "").map((f) => f.c.ofertaId),
      ["1", "2"],
    );
    assert.deepEqual(
      filtrar(filas, "todas", "acme").map((f) => f.c.ofertaId),
      ["1", "3"],
    );
    assert.deepEqual(
      filtrar(filas, "todas", "CAFE solido").map((f) => f.c.ofertaId),
      ["2"],
    );
    assert.deepEqual(filtrar(filas, "descartada", "backend"), []);
  });
});

describe("nombreCarta", () => {
  it("limpia tildes y símbolos y tiene respaldo", () => {
    assert.equal(nombreCarta("Café Sólido, S.L."), "Carta-Cafe-Solido-S-L.txt");
    assert.equal(nombreCarta("¿¡?!"), "Carta-Empresa.txt");
    assert.equal(nombreCarta(undefined), "Carta-Empresa.txt");
  });
});
