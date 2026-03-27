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
  preview: {
    port: 3001,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
