import { expect, test } from "@playwright/test";

test("un cambio hecho con la app en una pestaña se ve en otra sin recargar", async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/");
  await b.goto("/ofertas");
  await expect(b.getByText("Modo demo")).toHaveCount(0);
  await expect(b.getByRole("list")).toHaveCount(1);

  await a.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
  await expect(b.getByText("Modo demo: los datos")).toBeVisible();
  await expect(b.locator("li")).toHaveCount(6);
});
