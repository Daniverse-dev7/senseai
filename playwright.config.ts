import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const proxyServer = process.env.HTTPS_PROXY;
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: process.env.SENSEAI_TEST_URL || "http://127.0.0.1:3000",
    launchOptions: {
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      proxy: proxyServer
        ? { server: proxyServer, bypass: "127.0.0.1,localhost" }
        : undefined,
    },
  },
  reporter: [["list"]],
  outputDir: "test-results",
});
