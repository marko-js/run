import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post];

async function post({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
  });
  assert.equal(response.ok, true, "Post failed");

  const json = await response.json();

  assert.equal(json.foo, 1);
}
