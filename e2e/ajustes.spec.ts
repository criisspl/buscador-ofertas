import { expect, test } from "@playwright/test";

test("probar conexión con clave propia explica si funciona o por qué falla", async ({ page }) => {
  let estado = 401;
  await page.route("https://api.ejemplo.test/**", (r) =>
    estado === 200
      ? r.fulfill({ json: { choices: [{ message: { content: "ok" } }] } })
      : r.fulfill({ status: estado, json: {} }),
  );

  await page.goto("/ajustes");
  await page.getByLabel(/Mi propia clave/).check();
  await page.getByLabel("URL (compatible con OpenAI)").fill("https://api.ejemplo.test/v1/chat");
  await page.getByLabel("Modelo").fill("m");
  await page.getByLabel("Clave", { exact: true }).fill("k");

  await page.getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByText("La clave no es válida")).toBeVisible();

  // Al tocar un dato, el resultado anterior desaparece.
  estado = 200;
  await page.getByLabel("Modelo").fill("otro");
  await expect(page.getByText("La clave no es válida")).toHaveCount(0);
  await page.getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByText("Funciona: la IA ha respondido.")).toBeVisible();
});
