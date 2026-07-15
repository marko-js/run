import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post];

async function post({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: "post" });
  assert.equal(response.ok, true, "POST failed");
  const body = await response.text();
  assert.equal(body, "POST ok");
}
