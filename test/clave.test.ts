import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ajustesPropiaSugerida, ajustesSugeridos } from "../src/lib/ajustes.ts";
import { AlmacenDexie, BaseDatos } from "../src/lib/almacen/dexie.ts";
import { instantanea } from "../src/lib/copia.ts";
import { proveedorActual } from "../src/lib/ia/actual.ts";
import {
  bloquear,
  cifrarClave,
  claveDesbloqueada,
  desbloquear,
  descifrarClave,
} from "../src/lib/ia/clave.ts";
import { ID_PRESETS, PRESETS, presetDe } from "../src/lib/ia/presets.ts";
import { errorDeUrl } from "../src/lib/ia/url.ts";
import { AjustesSchema } from "../src/lib/esquemas.ts";
import { ErrorDescifrado } from "../src/lib/nube/cifrado.ts";

// Pocas iteraciones: la derivación real (600 000) es lenta y aquí no es lo que se prueba.
const IT = 1000;

afterEach(() => {
  bloquear();
  vi.unstubAllGlobals();
});

describe("clave de IA cifrada", () => {
  it("se descifra con la contraseña y no con otra", async () => {
    const blob = await cifrarClave("sk-secreta", "mi-contraseña", IT);
    assert.equal(await descifrarClave(blob, "mi-contraseña", IT), "sk-secreta");
    await assert.rejects(descifrarClave(blob, "otra-contraseña", IT), ErrorDescifrado);
  });

  it("el blob no contiene la clave en claro y cada cifrado es distinto", async () => {
    const a = await cifrarClave("sk-secreta", "mi-contraseña", IT);
    const b = await cifrarClave("sk-secreta", "mi-contraseña", IT);
    assert.ok(!JSON.stringify(a).includes("sk-secreta"));
    assert.notEqual(a.datos, b.datos);
    assert.ok(AjustesSchema.shape.claveCifrada.safeParse(a).success);
  });

  it("descifrada solo vive en memoria, hasta que se bloquea", () => {
    assert.equal(claveDesbloqueada(), undefined);
    desbloquear("sk-1");
    assert.equal(claveDesbloqueada(), "sk-1");
    bloquear();
    assert.equal(claveDesbloqueada(), undefined);
  });

  it("ni en IndexedDB ni en la copia hay rastro de la clave en claro", async () => {
    const db = new BaseDatos(`test-${Math.random()}`);
    const almacen = new AlmacenDexie(db);
    const blob = await cifrarClave("sk-secreta", "mi-contraseña", IT);
    await almacen.guardarAjustes({
      ...ajustesPropiaSugerida("openai"),
      configurado: true,
      claveCifrada: blob,
    });
    await almacen.guardarPerfil({
      id: "perfil",
      skills: ["React"],
      experiencia: [],
      idiomas: [],
      textoCv: "",
    });
    assert.ok(!JSON.stringify(await db.ajustes.toArray()).includes("sk-secreta"));
    const copia = await instantanea(almacen);
    assert.ok(!copia.includes("sk-secreta"));
    assert.ok(!copia.includes(blob.datos), "la copia no lleva ni los ajustes cifrados");
  });

  it("proveedorActual usa la clave desbloqueada y, bloqueada, falla pidiendo desbloquearla", async () => {
    const almacen = new AlmacenDexie(new BaseDatos(`test-${Math.random()}`));
    await almacen.guardarAjustes({
      ...ajustesPropiaSugerida("openai"),
      configurado: true,
      claveCifrada: await cifrarClave("sk-secreta", "mi-contraseña", IT),
    });
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "hola" } }] })),
      );
    vi.stubGlobal("fetch", f);

    await assert.rejects(
      (await proveedorActual(almacen)).preguntar({ texto: "x" }),
      /desbloquéala/,
    );
    assert.equal(f.mock.calls.length, 0);

    desbloquear("sk-secreta");
    assert.equal(await (await proveedorActual(almacen)).preguntar({ texto: "x" }), "hola");
    assert.equal(f.mock.calls[0][1].headers.authorization, "Bearer sk-secreta");
  });

  it("sin ajustes guardados se usa la configuración sugerida (IA de la app)", async () => {
    const almacen = new AlmacenDexie(new BaseDatos(`test-${Math.random()}`));
    assert.equal((await proveedorActual(almacen)).modo, "app");
  });
});

describe("proveedores predefinidos y destinos", () => {
  it("todos los predefinidos con dirección son https o local, y son editables (solo sugeridos)", () => {
    for (const id of ID_PRESETS) {
      const { url } = PRESETS[id];
      if (url) assert.equal(errorDeUrl(url), undefined, id);
    }
    assert.deepEqual(ID_PRESETS, ["groq", "mistral", "openai", "ollama", "otro"]);
    assert.equal(PRESETS.ollama.sinClave, true);
  });

  it("presetDe reconoce el predefinido por su dirección", () => {
    assert.equal(presetDe(PRESETS.mistral.url), "mistral");
    assert.equal(presetDe("https://mi-proxy.test/v1"), "otro");
    assert.equal(presetDe(undefined), "otro");
  });

  it("errorDeUrl exige https salvo en tu equipo y rechaza credenciales en la URL", () => {
    assert.equal(errorDeUrl("https://api.ejemplo.com/v1"), undefined);
    assert.equal(errorDeUrl("http://localhost:11434/v1"), undefined);
    assert.equal(errorDeUrl("http://127.0.0.1:8080/v1"), undefined);
    assert.match(errorDeUrl("http://api.ejemplo.com/v1") ?? "", /https/);
    assert.match(errorDeUrl("ftp://api.ejemplo.com") ?? "", /https/);
    assert.match(errorDeUrl("no es url") ?? "", /URL/);
    assert.match(errorDeUrl("https://u:p@api.ejemplo.com") ?? "", /usuario/);
  });

  it("la configuración sugerida es Dexie + IA de la app y aún sin configurar", () => {
    const s = ajustesSugeridos();
    assert.equal(s.almacenamiento, "dexie");
    assert.equal(s.modoIa, "app");
    assert.equal(s.configurado, false);
    assert.ok(AjustesSchema.safeParse(s).success);
  });
});
