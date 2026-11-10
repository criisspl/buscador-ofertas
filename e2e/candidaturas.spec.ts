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
