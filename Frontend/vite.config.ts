import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiMode =
    process.env.VITE_API_MODE ??
    env.VITE_API_MODE ??
    (process.env.CF_PAGES === "1" || mode === "demo" ? "mock" : "http");
  if (!["http", "mock"].includes(apiMode))
    throw new Error("VITE_API_MODE must be http or mock");
  return {
    define: { "import.meta.env.VITE_API_MODE": JSON.stringify(apiMode) },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: { sourcemap: false },
    server: {
      proxy: {
        "/api": {
          target: process.env.API_PROXY_TARGET || "http://127.0.0.1:8080",
          changeOrigin: false,
        },
      },
      host: "0.0.0.0",
      port: Number(process.env.PORT || 8443),
      strictPort: true,
    },
    preview: { host: "0.0.0.0" },
  };
});
