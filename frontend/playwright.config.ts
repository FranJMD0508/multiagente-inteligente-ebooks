import { defineConfig } from "@playwright/test";

// Pruebas de aceptación por requerimiento (e2e/requisitos.spec.ts).
// - En local levantan el build de producción en el puerto 3100 y usan Edge.
// - Con E2E_BASE_URL se ejecutan contra otro sitio (por ejemplo, GitHub Pages).
const PORT = 3100;
const baseURL = (process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/?$/, "/");

export default defineConfig({
  testDir: "./e2e",
  // El flujo con backend real tiene su propia configuración (playwright.backend.config.ts).
  testIgnore: ["**/backend.spec.ts"],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/informe" }]],
  use: {
    baseURL,
    locale: "es-ES",
    viewport: { width: 1440, height: 900 },
    channel: process.env.CI ? undefined : "msedge",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 300_000,
        // Estas pruebas son del modo demo, aunque .env.local apunte al backend
        // (las variables del proceso mandan sobre los archivos .env de Next).
        env: { NEXT_PUBLIC_API_MODE: "mock" },
      },
});
