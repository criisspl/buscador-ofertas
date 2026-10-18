import { defineConfig } from "@playwright/test";

const PUERTO = 3200;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // En local se puede apuntar a un Chromium ya instalado: PW_CHROMIUM=/ruta/al/chrome
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  // Contra la app compilada (`npm run build` antes), igual que en producción.
  webServer: {
    command: `npm run start -- -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
  },
});
