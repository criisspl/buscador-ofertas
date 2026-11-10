import { expect, test } from "@playwright/test";

test("borrar las ofertas no guardadas pide confirmación y conserva las guardadas", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
  await expect(page.getByText("Modo demo: los datos")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).first().click();
  await expect(page.getByRole("button", { name: "Guardada" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Puntuar 6 con la IA$/ })).toBeVisible();

  // Si se cancela, no se borra nada.
  page.once("dialog", (d) => void d.dismiss());
  await page.getByRole("button", { name: "Borrar ofertas no guardadas" }).click();
  await expect(page.getByRole("button", { name: /^Puntuar 6 con la IA$/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Se han borrado" })).toHaveCount(0);

  // Si se acepta, quedan solo las guardadas.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Borrar ofertas no guardadas" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Se han borrado 5 ofertas" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Puntuar 1 con la IA$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardada" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Borrar ofertas no guardadas" })).toHaveCount(0);
});
