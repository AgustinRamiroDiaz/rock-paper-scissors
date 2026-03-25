import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  retries: 1,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
  },
  webServer: [
    {
      command: "bun run dev:server",
      port: 2567,
      reuseExistingServer: true,
    },
    {
      command: "bun run dev:client",
      port: 3001,
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
