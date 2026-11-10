import { expect, test } from "@playwright/test";

const titulos = [
  ["/", "Buscador de ofertas"],
  ["/perfil", "Perfil · Buscador de ofertas"],
  ["/ofertas", "Ofertas · Buscador de ofertas"],
  ["/candidaturas", "Candidaturas · Buscador de ofertas"],
  ["/copia", "Copia de seguridad · Buscador de ofertas"],
  ["/ajustes", "Ajustes · Buscador de ofertas"],
] as const;

for (const [ruta, titulo] of titulos) {
  test(`la pestaña de ${ruta} se titula «${titulo}»`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page).toHaveTitle(titulo);
  });
}
