import { expect, test } from "@playwright/test";

test("avisa de hacer copia cuando hay datos, se puede posponer y se calla tras guardar una", async ({
  page,
}) => {
  await page.goto("/ofertas");
  await expect(page.getByText("hace tiempo que no haces copia")).toHaveCount(0);

  // Con un perfil guardado ya hay algo que perder.
  await page.evaluate(
    () =>
      new Promise<void>((ok, ko) => {
        const abre = indexedDB.open("buscador-ofertas");
        abre.onerror = () => ko(abre.error);
        abre.onsuccess = () => {
          const tx = abre.result.transaction("perfil", "readwrite");
          tx.objectStore("perfil").put({
            id: "perfil",
            skills: ["React"],
            experiencia: [],
            idiomas: [],
            textoCv: "x",
          });
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
        };
      }),
  );
  await page.reload();
  const aviso = page.getByText("hace tiempo que no haces copia");
  await expect(aviso).toBeVisible();

  await page.getByRole("button", { name: "Ahora no" }).click();
  await expect(aviso).toHaveCount(0);
  await page.reload();
  await expect(aviso).toHaveCount(0);

  // Pasados los días de gracia vuelve a avisar, y guardar una copia lo silencia.
  await page.evaluate(() => localStorage.removeItem("recordatorio-pospuesto"));
  await page.reload();
  await expect(aviso).toBeVisible();
  await page.evaluate(() => localStorage.setItem("ultima-copia", String(Date.now())));
  await page.reload();
  await expect(aviso).toHaveCount(0);
});
