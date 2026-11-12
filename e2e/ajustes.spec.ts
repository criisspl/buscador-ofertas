import { expect, test, type Page } from "@playwright/test";

/** Lo que hay guardado en la tabla `ajustes` de IndexedDB, tal cual (para comprobar que no hay claves en claro). */
const ajustesGuardados = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const abre = indexedDB.open("buscador-ofertas");
        abre.onerror = () => reject(abre.error);
        abre.onsuccess = () => {
          const pide = abre.result.transaction("ajustes").objectStore("ajustes").getAll();
          pide.onsuccess = () => resolve(pide.result);
          pide.onerror = () => reject(pide.error);
        };
      }),
  );

test("primer uso: la configuración sugerida deja Dexie local y la IA de la app", async ({
  page,
}) => {
  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { name: "Configura tu app" })).toBeVisible();
  await page.getByRole("button", { name: "Usar la configuración sugerida" }).click();

  await expect(page.getByText("Guardado")).toBeVisible();
  await expect(page.getByLabel("Almacenamiento")).toHaveValue("dexie");
  await expect(page.getByLabel(/IA de la app/)).toBeChecked();
  expect(await ajustesGuardados(page)).toMatchObject([
    { almacenamiento: "dexie", modoIa: "app", configurado: true },
  ]);

  // Ya configurado: no vuelve a salir el asistente.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
});

test("personalizar: elegir un proveedor rellena dirección y modelo, editables", async ({
  page,
}) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await expect(page.getByLabel(/Mi propia IA/)).toBeChecked();

  await page.locator("select").nth(1).selectOption("mistral");
  await expect(page.getByLabel("URL (compatible con OpenAI)")).toHaveValue(
    "https://api.mistral.ai/v1/chat/completions",
  );
  await expect(page.getByLabel("Modelo")).toHaveValue("mistral-small-latest");

  await page.getByLabel("Modelo").fill("otro-modelo");
  await expect(page.getByLabel("Modelo")).toHaveValue("otro-modelo");

  // Ollama corre en tu equipo: no pide clave.
  await page.locator("select").nth(1).selectOption("ollama");
  await expect(page.getByLabel("URL (compatible con OpenAI)")).toHaveValue(/localhost:11434/);
  await expect(page.getByLabel("Clave de la API")).toHaveCount(0);
});

test("la clave propia se guarda cifrada con contraseña y se desbloquea con ella", async ({
  page,
}) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByLabel("URL (compatible con OpenAI)").fill("https://api.ejemplo.test/v1/chat");
  await page.getByLabel("Modelo").fill("m");
  await page.getByLabel("Clave de la API").fill("sk-secreta-123");

  // Sin contraseña no guarda.
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/contraseña de al menos 8/)).toBeVisible();
  expect(await ajustesGuardados(page)).toHaveLength(0);

  await page.getByLabel("Contraseña para proteger la clave").fill("mi-contraseña-1");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();

  const guardado = JSON.stringify(await ajustesGuardados(page));
  expect(guardado).toContain("claveCifrada");
  expect(guardado).not.toContain("sk-secreta-123");
  expect(guardado).not.toContain("mi-contraseña-1");

  // Tras recargar la clave está bloqueada; una contraseña mala no la abre y la buena sí.
  await page.reload();
  await expect(page.getByText(/cifrada y bloqueada/)).toBeVisible();
  await page.getByLabel("Contraseña de tu clave").fill("incorrecta");
  await page.getByRole("button", { name: "Desbloquear clave" }).click();
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await page.getByLabel("Contraseña de tu clave").fill("mi-contraseña-1");
  await page.getByRole("button", { name: "Desbloquear clave" }).click();
  await expect(page.getByText("Clave desbloqueada en esta sesión.")).toBeVisible();

  // Con la clave desbloqueada la prueba llama al proveedor con ella.
  let autorizacion = "";
  await page.route("https://api.ejemplo.test/**", (r) => {
    autorizacion = r.request().headers()["authorization"] ?? "";
    return r.fulfill({ json: { choices: [{ message: { content: "ok" } }] } });
  });
  await page.getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByText("Funciona: la IA ha respondido.")).toBeVisible();
  expect(autorizacion).toBe("Bearer sk-secreta-123");
});

test("rechaza una dirección http fuera de tu equipo antes de guardar", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByLabel("URL (compatible con OpenAI)").fill("http://api.ejemplo.test/v1");
  await page.getByLabel("Modelo").fill("m");
  await page.getByLabel("Clave de la API").fill("k");
  await page.getByLabel("Contraseña para proteger la clave").fill("mi-contraseña-1");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/tiene que ser https/)).toBeVisible();
  expect(await ajustesGuardados(page)).toHaveLength(0);
});

test("quien ya tenía clave propia en claro la conserva y puede protegerla", async ({ page }) => {
  // Una base como la dejaba la versión anterior: ajustes con la clave en claro.
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        indexedDB.deleteDatabase("buscador-ofertas");
        const abre = indexedDB.open("buscador-ofertas", 10); // Dexie multiplica por 10 la versión.
        abre.onupgradeneeded = () => {
          const db = abre.result;
          for (const [n, k] of [
            ["ajustes", "id"],
            ["perfil", "id"],
            ["preferencias", "id"],
            ["ofertas", "id"],
            ["encajes", "ofertaId"],
            ["candidaturas", "ofertaId"],
          ])
            db.createObjectStore(n, { keyPath: k });
          abre.transaction!.objectStore("ajustes").put({
            id: "ajustes",
            modoIa: "propia",
            url: "https://api.ejemplo.test/v1/chat",
            modelo: "m",
            clave: "sk-antigua",
          });
        };
        abre.onsuccess = () => {
          abre.result.close();
          resolve();
        };
        abre.onerror = () => reject(abre.error);
      }),
  );

  await page.goto("/ajustes");
  // No sale el asistente: la configuración se conserva.
  await expect(page.getByLabel(/Mi propia IA/)).toBeChecked();
  await expect(page.getByLabel("URL (compatible con OpenAI)")).toHaveValue(
    "https://api.ejemplo.test/v1/chat",
  );
  await expect(page.getByText(/guardada sin proteger de antes/)).toBeVisible();

  await page.getByLabel("Contraseña para proteger la clave").fill("mi-contraseña-1");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();
  const guardado = JSON.stringify(await ajustesGuardados(page));
  expect(guardado).toContain("claveCifrada");
  expect(guardado).not.toContain("sk-antigua");
});

test("probar conexión con clave propia explica si funciona o por qué falla", async ({ page }) => {
  let estado = 401;
  await page.route("https://api.ejemplo.test/**", (r) =>
    estado === 200
      ? r.fulfill({ json: { choices: [{ message: { content: "ok" } }] } })
      : r.fulfill({ status: estado, json: {} }),
  );

  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByLabel("URL (compatible con OpenAI)").fill("https://api.ejemplo.test/v1/chat");
  await page.getByLabel("Modelo").fill("m");
  await page.getByLabel("Clave de la API").fill("k");

  await page.getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByText("La clave no es válida")).toBeVisible();

  // Al tocar un dato, el resultado anterior desaparece.
  estado = 200;
  await page.getByLabel("Modelo").fill("otro");
  await expect(page.getByText("La clave no es válida")).toHaveCount(0);
  await page.getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByText("Funciona: la IA ha respondido.")).toBeVisible();
});

test("copiar a otro almacenamiento: hoy no hay destino, pero se puede descargar una copia sin la clave", async ({
  page,
}) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Usar la configuración sugerida" }).click();
  await expect(page.getByRole("heading", { name: /Cambiar de almacenamiento/ })).toBeVisible();
  await expect(page.getByText(/no hay a dónde copiar/)).toBeVisible();

  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia (JSON)" }).click();
  const fichero = await descarga;
  expect(fichero.suggestedFilename()).toBe("buscador-ofertas-copia.json");
  const texto = await (await import("node:fs/promises")).readFile((await fichero.path())!, "utf8");
  expect(JSON.parse(texto)).toMatchObject({ version: 1, ofertas: [], candidaturas: [] });
  expect(texto).not.toContain("clave");
});
