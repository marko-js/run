import assert from "assert";

import { StepContext } from "../../main.test";

export const steps = [headRequest, getRequest];

async function headRequest({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  // Give the handler's promise time to reject.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function getRequest({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: "GET" });
  assert.equal(response.status, 200);
}
