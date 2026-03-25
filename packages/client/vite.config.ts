import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 3001,
  },
  resolve: {
    conditions: ["browser", "import", "module", "default"],
  },
});
