import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// Prueba de punta a punta con el backend real (FastAPI + LangGraph) y el
// frontend en modo "http". Usa el proveedor de IA "demo" (sin conexión ni
// clave) y una base de datos temporal, así que no toca tus datos.
//
//   npm run test:e2e:backend
//
// Requisito: el entorno de Python del backend instalado (ver backend/README.md).
// Con FOLIO_E2E_REUSE=1 reutiliza servidores ya levantados en esos puertos.
const API_PORT = 8100;
const WEB_PORT = 3200;
const backendDir = path.resolve(__dirname, "../backend");
const python =
  process.env.FOLIO_PYTHON ??
  path.join(backendDir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
// Una carpeta de datos nueva en cada ejecución (fuera de test-results, que Playwright vacía).
process.env.FOLIO_E2E_DATA ??= path.join(os.tmpdir(), `folio-e2e-${Date.now()}`);
const dataDir = process.env.FOLIO_E2E_DATA;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "backend.spec.ts",
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}/`,
    locale: "es-ES",
    viewport: { width: 1440, height: 900 },
    channel: process.env.CI ? undefined : "msedge",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: backendDir,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: Boolean(process.env.FOLIO_E2E_REUSE),
      timeout: 120_000,
      env: {
        LLM_PROVIDER: "demo",
        DEMO_DELAY_MS: "2",
        UI_STEP_DELAY_MS: "40",
        DATA_DIR: dataDir,
        REFERENCES_LOOKUP: "false",
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        FRONTEND_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: Boolean(process.env.FOLIO_E2E_REUSE),
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_MODE: "http",
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_DIST_DIR: ".next-backend",
      },
    },
  ],
});
