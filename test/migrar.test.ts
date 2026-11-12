import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import { ErrorMigracion, migrar, type FaseMigracion } from "../src/lib/almacen/migrar.ts";
import type { Almacenamiento } from "../src/lib/almacen/tipos.ts";
import { instantanea } from "../src/lib/copia.ts";
import type { Ajustes, Candidatura, Encaje, Oferta, Perfil } from "../src/lib/tipos.ts";
import { AlmacenMemoria } from "./almacen-memoria.ts";

const oferta = (id: string): Oferta => ({
  id,
  fuente: "adzuna",
  idExterno: id,
  titulo: `Titulo ${id}`,
  empresa: "X",
  ubicacion: "Madrid",
  url: "https://x.test",
  descripcion: "",
});
const encaje = (ofertaId: string): Encaje => ({
  ofertaId,
  nota: 70,
  cumple: ["a"],
  falta: [],
  proveedor: "test",
});
const candidatura = (ofertaId: string): Candidatura => ({
  ofertaId,
  estado: "guardada",
  carta: "hola",
  notas: "",
  creada: 1,
  actualizada: 2,
});
const perfil = (skill: string): Perfil => ({
  id: "perfil",
  skills: [skill],
  experiencia: [],
  idiomas: [],
  textoCv: "cv",
});
const ajustes: Ajustes = {
  id: "ajustes",
  almacenamiento: "dexie",
  modoIa: "propia",
  proveedorIa: "otro",
  url: "https://api.test/v1",
  modelo: "m",
  claveCifrada: { v: 1, salt: "s", iv: "i", datos: "SECRETO-CIFRADO" },
  clave: "sk-EN-CLARO",
  configurado: true,
};

async function conDatos(a: Almacenamiento, skill = "ts") {
  await a.guardarAjustes(ajustes);
  await a.escribirLote({
    perfil: perfil(skill),
    preferencias: {
      id: "preferencias",
      puestos: ["dev"],
      ubicacion: "",
      remoto: false,
      sectoresEvitar: [],
    },
    ofertas: [oferta("1"), oferta("2")],
    encajes: [encaje("1")],
    candidaturas: [candidatura("1")],
  });
}

let dexie: AlmacenDexie;
let mem: AlmacenMemoria;
beforeEach(async () => {
  const db = new BaseDatos(`test-${Math.random()}`);
  await db.open();
  dexie = new AlmacenDexie(db);
  mem = new AlmacenMemoria();
});

const falla = async (p: Promise<unknown>, codigo: string) => {
  const e = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  assert.ok(e instanceof ErrorMigracion, "esperaba ErrorMigracion");
  assert.equal(e.codigo, codigo);
  return e;
};

describe("migrar", () => {
  it("round-trip Dexie → memoria → Dexie conserva todos los datos", async () => {
    await conDatos(dexie);
    const antes = await instantanea(dexie);
    const r = await migrar(dexie, mem);
    assert.deepEqual(
      { ...r, copiaPrevia: undefined },
      { perfil: true, ofertas: 2, encajes: 1, candidaturas: 1, copiaPrevia: undefined },
    );
    assert.equal(await instantanea(mem), antes);

    const db2 = new BaseDatos(`test-${Math.random()}`);
    await db2.open();
    const vuelta = new AlmacenDexie(db2);
    await migrar(mem, vuelta);
    assert.equal(await instantanea(vuelta), antes);
  });

  it("no copia los ajustes ni la clave de IA; el destino conserva los suyos", async () => {
    await conDatos(dexie);
    const propios: Ajustes = {
      ...ajustes,
      modoIa: "demo",
      clave: undefined,
      claveCifrada: undefined,
    };
    await mem.guardarAjustes(propios);
    await migrar(dexie, mem);
    assert.deepEqual(await mem.leerAjustes(), propios);
    assert.ok(!(await instantanea(mem)).includes("SECRETO"));
    assert.ok(!JSON.stringify(await mem.leerDatos()).includes("sk-EN-CLARO"));
  });

  it("el origen no se modifica", async () => {
    await conDatos(dexie);
    const antes = JSON.stringify([await dexie.leerDatos(), await dexie.leerAjustes()]);
    await migrar(dexie, mem);
    assert.equal(JSON.stringify([await dexie.leerDatos(), await dexie.leerAjustes()]), antes);
  });

  it("informa del progreso fase a fase", async () => {
    await conDatos(dexie);
    const vistas: [FaseMigracion, number, number][] = [];
    await migrar(dexie, mem, { alProgreso: (f, p, t) => vistas.push([f, p, t]) });
    assert.deepEqual(vistas, [
      ["leyendo", 1, 5],
      ["validando", 2, 5],
      ["copia-previa", 3, 5],
      ["escribiendo", 4, 5],
      ["verificando", 5, 5],
    ]);
  });

  it("destino no vacío: se niega sin confirmación y no escribe nada", async () => {
    await conDatos(dexie);
    await conDatos(mem, "otra");
    const antes = await instantanea(mem);
    await falla(migrar(dexie, mem), "destino-no-vacio");
    assert.equal(mem.escrituras, 1); // la del montaje
    assert.equal(await instantanea(mem), antes);
  });

  it("destino con solo ofertas también cuenta como no vacío", async () => {
    await dexie.guardarPerfil(perfil("ts"));
    await mem.guardarOferta(oferta("9"));
    await falla(migrar(dexie, mem), "destino-no-vacio");
  });

  it("destino no vacío con confirmación: sustituye por clave y devuelve copia previa", async () => {
    await conDatos(dexie);
    await conDatos(mem, "otra");
    await mem.guardarOferta(oferta("solo-destino"));
    const previa = await instantanea(mem);
    const r = await migrar(dexie, mem, { sobrescribir: true });
    assert.equal(r.copiaPrevia, previa);
    assert.deepEqual((await mem.leerPerfil())?.skills, ["ts"]);
    assert.ok((await mem.listarOfertas()).some((o) => o.id === "solo-destino"));
  });

  it("fallo a mitad: el origen queda intacto, el destino sin cambios y se avisa", async () => {
    await conDatos(dexie);
    await conDatos(mem, "otra");
    const origenAntes = await instantanea(dexie);
    const destinoAntes = await instantanea(mem);
    mem.falloAlEscribir = new Error("sin espacio");
    const e = await falla(migrar(dexie, mem, { sobrescribir: true }), "escritura");
    assert.match(e.message, /sin espacio/);
    assert.match(e.message, /origen siguen intactos/);
    assert.equal(e.copiaPrevia, destinoAntes);
    assert.equal(await instantanea(dexie), origenAntes);
    assert.equal(await instantanea(mem), destinoAntes);
  });

  it("destino que escribe mal: la verificación lo detecta", async () => {
    await conDatos(dexie);
    const roto = new AlmacenMemoria();
    roto.escribirLote = async () => {}; // dice que ha escrito y no escribe
    await falla(migrar(dexie, roto), "verificacion");
    assert.equal((await dexie.listarOfertas()).length, 2);
  });

  it("datos de origen corruptos: no se copia nada", async () => {
    await conDatos(dexie);
    const corrupto = new AlmacenMemoria();
    await corrupto.guardarPerfil({ id: "perfil", skills: "no-es-lista" } as unknown as Perfil);
    const e = await falla(migrar(corrupto, mem), "origen-invalido");
    assert.match(e.message, /formato esperado/);
    assert.equal(mem.escrituras, 0);
  });

  it("origen demasiado grande: se rechaza", async () => {
    const grande = new AlmacenMemoria();
    await grande.guardarOferta({ ...oferta("g"), descripcion: "x".repeat(26_000_000) });
    await falla(migrar(grande, mem), "origen-invalido");
    assert.equal(mem.escrituras, 0);
  });

  it("limpia campos desconocidos del origen", async () => {
    await conDatos(dexie);
    await dexie.guardarOferta({ ...oferta("3"), extra: "basura" } as Oferta);
    await migrar(dexie, mem);
    const o = (await mem.listarOfertas()).find((x) => x.id === "3");
    assert.ok(o && !("extra" in o));
  });

  it("cancelación antes de escribir: no se toca ningún almacenamiento", async () => {
    await conDatos(dexie);
    const control = new AbortController();
    await falla(
      migrar(dexie, mem, {
        senal: control.signal,
        alProgreso: (fase) => fase === "copia-previa" && control.abort(),
      }),
      "cancelada",
    );
    assert.equal(mem.escrituras, 0);
    assert.equal((await dexie.listarOfertas()).length, 2);
  });

  it("origen y destino iguales: error", async () => {
    await falla(migrar(mem, mem), "mismo-almacen");
  });
});
