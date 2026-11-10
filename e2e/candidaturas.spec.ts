import { expect, test } from "@playwright/test";

test("filtra las candidaturas por estado y por búsqueda", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
  await expect(page.getByText("Modo demo: los datos")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).nth(0).click();
  await page.getByRole("button", { name: "Guardar" }).nth(1).click();
  await page.getByRole("link", { name: "Candidaturas" }).click();

  await expect(page.getByRole("button", { name: /^En marcha 2$/ })).toBeVisible();
  await page.getByLabel("Estado").first().selectOption("descartada");
  await expect(page.getByRole("button", { name: /^En marcha 1$/ })).toBeVisible();
  await expect(page.getByLabel("Estado")).toHaveCount(1);

  await page.getByRole("button", { name: /^Descartada 1$/ }).click();
  await expect(page.getByLabel("Estado")).toHaveValue("descartada");

  await page.getByRole("button", { name: /^Todas 2$/ }).click();
  await expect(page.getByLabel("Estado")).toHaveCount(2);
  await page.getByLabel("Buscar empresa o puesto").fill("zzz-no-existe");
  await expect(page.getByText("No hay candidaturas con este filtro")).toBeVisible();
});

test("las notas se autoguardan y la carta se copia y se descarga", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
  await expect(page.getByText("Modo demo: los datos")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).first().click();
  await page.getByRole("link", { name: "Candidaturas" }).click();

  await page.getByLabel("Notas").fill("Hablé con RRHH");
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Notas")).toHaveValue("Hablé con RRHH");

  await expect(page.getByRole("button", { name: "Copiar carta" })).toHaveCount(0);
  await page.getByRole("button", { name: /Escribir carta/ }).click();
  await page.getByRole("button", { name: "Copiar carta" }).click();
  await expect(page.getByRole("button", { name: "Copiada" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/modo demo/);

  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: /Descargar carta/ }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^Carta-.+\.txt$/);
});
