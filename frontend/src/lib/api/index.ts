// Punto único de acceso a los datos (docs/03 §8). Los componentes solo usan
// `api` y los hooks de hooks.ts; la implementación depende del modo:
// - "mock": los cuatro agentes se simulan en el navegador (GitHub Pages).
// - "http": backend FastAPI + LangGraph con agentes reales (backend/).

import type { FolioApi } from "./contract";
import { httpApi } from "./http/api";
import { mockApi } from "./mock/api";
import { simSettings } from "./mock/simulator";
import { API_MODE } from "./mode";

export const api: FolioApi = API_MODE === "http" ? httpApi : mockApi;

export { API_MODE, IS_DEMO } from "./mode";

/** Segundos aproximados que tarda un capítulo (para el tiempo restante). */
export function secondsPerChapter(): number {
  return API_MODE === "http" ? 30 : 16 / simSettings.speed;
}
