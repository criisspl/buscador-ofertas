import type { Page } from "@playwright/test";

/** Despliega todas las fichas de /candidaturas (vienen cerradas). */
export async function abreFichas(page: Page) {
  await page
    .locator("details")
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
}
