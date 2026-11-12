import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import { GET } from "../src/app/api/copia/route.ts";
import { instantanea } from "../src/lib/copia.ts";
import { cifrar, descifrar, ErrorDescifrado, idDe, tokenDe } from "../src/lib/nube/cifrado.ts";
import { bajar, borrarCopia, ErrorNube, subir } from "../src/lib/nube/cliente.ts";
import {
  borrar,
  escribir,
  leer,
  MAX_BLOB,
  type Almacen,
  type Registro,
} from "../src/lib/nube/servidor.ts";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";

const IT = 1000; // pocas iteraciones: aquí se prueba la lógica, no el coste de PBKDF2

function memoria(): Almacen & { datos: Map<string, Registro> } {
  const datos = new Map<string, Registro>();
  return {
    datos,
    get: async (k) => datos.get(k) ?? null,
    set: async (k, v) => void datos.set(k, v),
    del: async (k) => void datos.delete(k),
  };
}

/** fetch falso que habla con el servidor real (sin red) sobre un almacén en memoria. */
function servidor(a: Almacen): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const m = init?.method ?? "GET";
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    const r =
      m === "GET"
        ? await leer(a, new URL(url, "https://x.test").searchParams.get("id"))
        : m === "PUT"
          ? await escribir(a, cuerpo)
          : await borrar(a, cuerpo);
    return new Response(JSON.stringify(r.cuerpo), { status: r.status });
  }) as typeof fetch;
}

describe("cifrado", () => {
  it("descifra con la contraseña correcta", async () => {
    const b = await cifrar("hola mundo", "clave-larga", undefined, IT);
    assert.equal(await descifrar(b, "clave-larga", IT), "hola mundo");
  });
  it("funciona con las iteraciones reales (600k)", async () => {
    const b = await cifrar("x", "clave");
    assert.equal(await descifrar(b, "clave"), "x");
  });
  it("cifra textos grandes (cientos de KB) sin reventar", async () => {
    const grande = "ñ".repeat(300_000);
    const b = await cifrar(grande, "clave", undefined, IT);
    assert.equal(await descifrar(b, "clave", IT), grande);
  });
  it("falla con otra contraseña o con datos tocados", async () => {
    const b = await cifrar("secreto", "uno", undefined, IT);
    await assert.rejects(descifrar(b, "dos", IT), ErrorDescifrado);
    const roto = { ...b, datos: b.datos.slice(0, -4) + "AAAA" };
    await assert.rejects(descifrar(roto, "uno", IT), ErrorDescifrado);
  });
  it("el blob no contiene el texto en claro y cada cifrado usa un iv distinto", async () => {
    const a = await cifrar("texto reconocible", "p", "c2FsMTIzNDU2Nzg5MA==", IT);
    const b = await cifrar("texto reconocible", "p", "c2FsMTIzNDU2Nzg5MA==", IT);
    assert.ok(!JSON.stringify(a).includes("reconocible"));
    assert.notEqual(a.iv, b.iv);
  });
  it("el token depende de la contraseña y de la sal, y no es la clave de cifrado", async () => {
    const s = "c2FsMTIzNDU2Nzg5MA==";
    assert.equal(await tokenDe("p", s, IT), await tokenDe("p", s, IT));
    assert.notEqual(await tokenDe("p", s, IT), await tokenDe("q", s, IT));
  });
  it("el id ignora mayúsculas y espacios del alias", async () => {
    assert.equal(await idDe(" Cris "), await idDe("cris"));
    assert.match(await idDe("cris"), /^[0-9a-f]{64}$/);
  });
});

describe("ruta /api/copia", () => {
  const pet = (origen = "https://web.test") =>
    new Request("https://web.test/api/copia?id=" + "a".repeat(64), { headers: { origin: origen } });
  it("rechaza otros orígenes y responde 503 sin almacenamiento configurado", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    assert.equal((await GET(pet("https://otra.test"))).status, 403);
    assert.equal((await GET(pet())).status, 503);
    vi.unstubAllEnvs();
  });
});

describe("servidor", () => {
  const id = "a".repeat(64);
  const blob = { v: 1, salt: "AAAA", iv: "AAAA", datos: "AAAA" };

  it("rechaza ids, tokens y blobs mal formados", async () => {
    const a = memoria();
    assert.equal((await leer(a, "x")).status, 400);
    assert.equal((await escribir(a, { id: "x", token: "t", blob })).status, 400);
    assert.equal((await escribir(a, { id, token: "t", blob: { v: 1 } })).status, 400);
    assert.equal(
      (await escribir(a, { id, token: "t", blob: { ...blob, datos: "<script>" } })).status,
      400,
    );
  });
  it("rechaza copias demasiado grandes", async () => {
    const grande = { ...blob, datos: "A".repeat(MAX_BLOB) };
    assert.equal((await escribir(memoria(), { id, token: "t", blob: grande })).status, 413);
  });
  it("solo quien tiene el token puede sobrescribir o borrar", async () => {
    const a = memoria();
    assert.equal((await escribir(a, { id, token: "bueno", blob })).status, 200);
    assert.equal((await escribir(a, { id, token: "malo", blob })).status, 403);
    assert.equal((await borrar(a, { id, token: "malo" })).status, 403);
    assert.equal((await escribir(a, { id, token: "bueno", blob })).status, 200);
    assert.equal((await borrar(a, { id, token: "bueno" })).status, 200);
    assert.equal((await leer(a, id)).status, 404);
  });
  it("no guarda el token en claro", async () => {
    const a = memoria();
    await escribir(a, { id, token: "token-secreto", blob });
    assert.ok(!JSON.stringify([...a.datos.values()]).includes("token-secreto"));
  });
});

describe("subir y bajar", () => {
  let db: BaseDatos;
  let almacen: AlmacenDexie;
  beforeEach(async () => {
    db = new BaseDatos(`test-${Math.random()}`);
    await db.open();
    almacen = new AlmacenDexie(db);
    await db.perfil.put({
      id: "perfil",
      skills: ["React"],
      experiencia: [],
      idiomas: [],
      textoCv: "",
    });
    await db.ajustes.put({
      id: "ajustes",
      almacenamiento: "dexie",
      proveedorIa: "otro",
      configurado: true,
      modoIa: "propia",
      clave: "sk-no-subir",
    });
  });

  it("la copia no incluye los ajustes ni la clave de IA", async () => {
    assert.ok(!(await instantanea(almacen)).includes("sk-no-subir"));
  });

  it("sube y recupera en otro navegador con alias y contraseña", async () => {
    const a = memoria();
    const f = servidor(a);
    await subir(almacen, "cris", "mi-contraseña", f, IT);
    assert.ok(!JSON.stringify([...a.datos.values()]).includes("React"));
    const otro = new BaseDatos(`test-${Math.random()}`);
    await otro.open();
    await bajar(new AlmacenDexie(otro), "Cris", "mi-contraseña", f, IT);
    assert.deepEqual((await otro.perfil.get("perfil"))?.skills, ["React"]);
  });
  it("actualizar con la misma contraseña funciona; con otra, no", async () => {
    const f = servidor(memoria());
    await subir(almacen, "cris", "uno", f, IT);
    await subir(almacen, "cris", "uno", f, IT);
    await assert.rejects(subir(almacen, "cris", "otra", f, IT), ErrorNube);
  });
  it("recuperar con contraseña incorrecta no toca los datos locales", async () => {
    const f = servidor(memoria());
    await subir(almacen, "cris", "uno", f, IT);
    const otro = new BaseDatos(`test-${Math.random()}`);
    await otro.open();
    await assert.rejects(bajar(new AlmacenDexie(otro), "cris", "dos", f, IT), ErrorDescifrado);
    assert.equal(await otro.perfil.count(), 0);
  });
  it("borra la copia con la contraseña correcta", async () => {
    const f = servidor(memoria());
    await subir(almacen, "cris", "uno", f, IT);
    await assert.rejects(borrarCopia("cris", "mal", f, IT), ErrorNube);
    await borrarCopia("cris", "uno", f, IT);
    await assert.rejects(bajar(almacen, "cris", "uno", f, IT), ErrorNube);
  });
});
