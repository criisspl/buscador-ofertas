import { expect, test, type BrowserContext } from "@playwright/test";

// Servidor de copias simulado en memoria: lo que interesa aquí es el cifrado real del navegador.
function servidorSimulado() {
  const guardado = new Map<string, { id: string; token: string; blob: unknown }>();
  return async (ctx: BrowserContext) =>
    ctx.route("**/api/copia*", async (ruta) => {
      const req = ruta.request();
      if (req.method() === "GET") {
        const x = guardado.get(new URL(req.url()).searchParams.get("id") ?? "");
        return x
          ? ruta.fulfill({ json: { blob: x.blob, actualizada: 1 } })
          : ruta.fulfill({ status: 404, json: { mensaje: "No hay ninguna copia con ese alias." } });
      }
      const c = req.postDataJSON();
      if (req.method() === "PUT") {
        const previo = guardado.get(c.id);
        if (previo && previo.token !== c.token)
          return ruta.fulfill({
            status: 403,
            json: { mensaje: "Esa copia ya existe con otra contraseña." },
          });
        guardado.set(c.id, c);
        return ruta.fulfill({ json: { actualizada: Date.now() } });
      }
      guardado.delete(c.id);
      return ruta.fulfill({ json: { ok: true } });
    });
}

test("una copia cifrada se recupera en otro navegador, y con otra contraseña no", async ({
  browser,
}) => {
  const sirve = servidorSimulado();
  const guardadoVisto: string[] = [];

  const a = await browser.newContext();
  await sirve(a);
  a.on("request", (r) => {
    if (r.method() === "PUT") guardadoVisto.push(r.postData() ?? "");
  });
  const pa = await a.newPage();
  await pa.goto("/perfil");
  await pa.getByLabel(/^Puestos/).fill("Backend Secreto");
  await pa.getByRole("button", { name: "Guardar" }).last().click();
  await expect(pa.getByText("Guardado")).toBeVisible();

  await pa.goto("/copia");
  await pa.getByLabel("Alias").fill("cris");
  await pa.getByLabel(/^Contraseña/).fill("corta");
  await expect(pa.getByRole("button", { name: "Guardar copia" })).toBeDisabled();
  await pa.getByLabel(/^Contraseña/).fill("una-contraseña-larga");
  await pa.getByRole("button", { name: "Guardar copia" }).click();
  await expect(pa.getByText(/Copia guardada/)).toBeVisible({ timeout: 20_000 });
  expect(guardadoVisto.join("")).not.toContain("Secreto");

  const b = await browser.newContext();
  await sirve(b);
  const pb = await b.newPage();
  await pb.goto("/copia");
  await pb.getByLabel("Alias").fill("CRIS");
  await pb.getByLabel(/^Contraseña/).fill("otra-contraseña-mala");
  await pb.getByRole("button", { name: "Recuperar copia" }).click();
  await expect(pb.getByText(/incorrecta/)).toBeVisible({ timeout: 20_000 });

  await pb.getByLabel(/^Contraseña/).fill("una-contraseña-larga");
  await pb.getByRole("button", { name: "Recuperar copia" }).click();
  await expect(pb.getByText(/Datos recuperados/)).toBeVisible({ timeout: 20_000 });
  await pb.goto("/perfil");
  await expect(pb.getByLabel(/^Puestos/)).toHaveValue("Backend Secreto");
});
