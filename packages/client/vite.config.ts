import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  envDir: "../..",
  root: ".",
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: ["rps.agustinramirodiaz.dev"]
  },
  resolve: {
    conditions: ["browser", "import", "module", "default"],
  },
});
