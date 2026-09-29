import type { NextConfig } from "next";

// Con GITHUB_PAGES=true se genera un sitio estático (carpeta out/) servido desde
// https://franjmd0508.github.io/multiagente-inteligente-ebooks/. En desarrollo
// y con `next start` la app funciona como siempre, en la raíz.
const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? "/multiagente-inteligente-ebooks" : "";

const nextConfig: NextConfig = {
  ...(pages ? { output: "export" as const, trailingSlash: true } : {}),
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
