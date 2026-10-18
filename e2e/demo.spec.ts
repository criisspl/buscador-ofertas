import { expect, test } from "@playwright/test";

test("el modo demo funciona de principio a fin sin red", async ({ page }) => {
  const llamadasApi: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) llamadasApi.push(r.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
  await expect(page.getByText("Modo demo: los datos")).toBeVisible();
  await expect(page.locator("li")).toHaveCount(6);

  await page.getByRole("button", { name: /Puntuar 6/ }).click();
  await expect(page.getByText(/Encaje:/)).toHaveCount(6);
  // La mejor oferta va primero y la peor la última.
  const titulos = await page.locator("li a").allTextContents();
  expect(titulos.at(-1)).toContain("backend Java");

  await page.getByRole("button", { name: "Guardar" }).first().click();
  await page.getByRole("link", { name: "Candidaturas" }).click();
  await page.getByLabel("Estado").selectOption("entrevista");
  await page.getByRole("button", { name: /Escribir carta/ }).click();
  await expect(page.getByLabel("Carta de presentación")).toHaveValue(/modo demo/);

  await page.reload();
  await expect(page.getByLabel("Estado")).toHaveValue("entrevista");
  expect(llamadasApi).toEqual([]);
});
