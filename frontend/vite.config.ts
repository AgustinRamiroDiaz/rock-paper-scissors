import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: ".",
  root: ".",
  plugins: [vue()],
  resolve: {
    alias: {
      "@rps/shared": resolve(__dirname, "./shared/src"),
    },
    conditions: ["browser", "import", "module", "default"],
  },
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: ["rps.agustinramirodiaz.dev"]
  },
});
