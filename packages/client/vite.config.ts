import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: ".",
  plugins: [vue()],
  server: {
    port: 3001,
  },
  resolve: {
    conditions: ["browser", "import", "module", "default"],
  },
});
