import { expect, test } from "@playwright/test";

const rutas = ["/", "/perfil", "/ofertas", "/ajustes", "/copia", "/candidaturas"];

test.describe("móvil 390x844", () => {
  test.skip(({ isMobile }) => !isMobile, "solo en el proyecto móvil");

  for (const ruta of rutas) {
    test(`${ruta} no desborda en horizontal`, async ({ page }) => {
      await page.goto(ruta);
      const { ancho, visible } = await page.evaluate(() => ({
        ancho: document.documentElement.scrollWidth,
        visible: window.innerWidth,
      }));
      expect(ancho).toBe(visible);
    });
  }

  test("el nav marca la página actual también en /", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Buscador de ofertas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("nav a[aria-current='page']")).toHaveCount(1);
  });

  test("los botones miden al menos 44px de alto", async ({ page }) => {
    await page.goto("/ofertas");
    const caja = await page.locator(".boton").first().boundingBox();
    expect(caja?.height).toBeGreaterThanOrEqual(44);
  });
});
