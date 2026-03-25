import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:2567",
      },
      "/matchmake": {
        target: "http://localhost:2567",
      },
      "/colyseus": {
        target: "ws://localhost:2567",
        ws: true,
      },
    },
  },
  resolve: {
    conditions: ["browser", "import", "module", "default"],
  },
});
