import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
export default defineConfig({
  testDir: ".", testMatch: "*.spec.mjs", workers: 1, retries: 0,
  timeout: 90_000, expect: { timeout: 25_000 },
  reporter: [["list"],["html",{open:"never"}]],
  use: { baseURL:"http://127.0.0.1:3000", trace:"retain-on-failure", screenshot:"only-on-failure" },
  webServer: { command:"pnpm --filter @yieldline/frontend start", cwd:root,
    url:"http://127.0.0.1:3000", reuseExistingServer:false, timeout:120_000 },
});
