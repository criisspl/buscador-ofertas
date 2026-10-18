import { expect, test } from "@playwright/test";

test("el CV se lee en el navegador y solo se envía a la IA tras dar permiso", async ({ page }) => {
  let peticionesIa = 0;
  await page.route("**/api/ia", (ruta) => {
    peticionesIa++;
    return ruta.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                skills: ["React", "TypeScript"],
                experiencia: [{ puesto: "Frontend Dev", empresa: "Acme" }],
                idiomas: ["Español"],
              }),
            },
          },
        ],
      },
    });
  });

  await page.goto("/perfil");
  await page.getByLabel("Subir CV en PDF").setInputFiles("e2e/fixtures/cv.pdf");
  await expect(page.getByText("se enviará a la IA")).toBeVisible();
  expect(peticionesIa).toBe(0);

  await page.getByRole("button", { name: "Sí, generar perfil" }).click();
  await expect(page.getByLabel(/Habilidades/)).toHaveValue("React, TypeScript");

  await page.getByLabel(/^Puestos/).fill("Frontend, React");
  await page.getByRole("button", { name: "Guardar" }).last().click();
  await expect(page.getByText("Guardado")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/Habilidades/)).toHaveValue("React, TypeScript");
  await expect(page.getByLabel(/^Puestos/)).toHaveValue("Frontend, React");
});

test("un archivo que no es PDF se rechaza con un mensaje claro", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByLabel("Subir CV en PDF").setInputFiles({
    name: "cv.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hola"),
  });
  await expect(page.getByText("Sube un PDF.")).toBeVisible();
});
