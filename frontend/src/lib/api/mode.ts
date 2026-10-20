// Modo de la capa de datos (docs/03 §8): "mock" simula los agentes en el
// navegador (es lo que se publica en GitHub Pages); "http" habla con el backend
// FastAPI. Se elige al compilar con NEXT_PUBLIC_API_MODE.

export const API_MODE: "mock" | "http" = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

/** URL base del backend (sin barra final). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export const IS_DEMO = API_MODE === "mock";
