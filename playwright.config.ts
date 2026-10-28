import { defineConfig } from "playwright/test";
import { webkit } from "playwright-safari26";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: Number(process.env.MARKO_TEST_WORKERS) || 2,
  timeout: 15000,
  globalTimeout: 10 * 60 * 1000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure" },
  projects: ["chromium", "firefox", "webkit", "safari26"].flatMap((name) =>
    [false, true].map((base) => ({
      name: name + (base ? "-base" : ""),
      metadata: { base, precommit: name !== "safari26" },
      use: {
        browserName:
          name === "safari26"
            ? ("webkit" as const)
            : (name as "chromium" | "firefox" | "webkit"),
        launchOptions: {
          executablePath:
            name === "safari26"
              ? process.env.SAFARI26_EXECUTABLE_PATH || webkit.executablePath()
              : name === "webkit"
                ? process.env.WEBKIT_EXECUTABLE_PATH
                : undefined,
        },
      },
    })),
  ),
});
