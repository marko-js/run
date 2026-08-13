import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const entry = "src/index.ts";
export const path = "/?foo=bar";

export const steps: Step[] = [trailingSlashRedirects];

// The default `trailingSlashes: "RedirectWithout"` must apply through the
// `matchMiddleware` + `invokeMiddleware` pair, not just the generated `fetch`.
async function trailingSlashRedirects({ page }: StepContext) {
  const url = new URL("/sub/", page.url());
  const response = await page.fetch(url, { redirect: "manual" });

  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")!).pathname, "/sub");
}
