import assert from "assert";

import { Step } from "../../main.test";

export const steps: Step[] = [
  (ctx) => assertNoBody("HEAD")(ctx),
  (ctx) => assertBody("POST")(ctx),
  (ctx) => assertBody("PUT")(ctx),
  (ctx) => assertBody("DELETE")(ctx),
  (ctx) => assertBody("PATCH")(ctx),
  (ctx) => assertBody("OPTIONS")(ctx),
];

function assertBody(method: string): Step {
  return async ({ page }) => {
    const url = new URL(page.url());
    const response = await page.request.fetch(url.href, { method });
    assert.equal(response.ok(), true, `Response for ${method} is not ok`);
    const body = await response.text();
    assert.equal(
      body,
      `handler: ${method} ${url.pathname}`,
      `Response for ${method} has an unexpected body: "${body}"`,
    );
  };
}

function assertNoBody(method: string): Step {
  return async ({ page }) => {
    const url = new URL(page.url());
    const response = await page.request.fetch(url.href, { method });
    assert.equal(response.ok(), true, `Response for ${method} is not ok`);
    const body = await response.text();
    assert.equal(
      body,
      "",
      `Response for ${method} has a non-empty body: "${body}"`,
    );
  };
}
