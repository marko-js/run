import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post];

async function post({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
  });
  assert.equal(response.ok, true, "Post failed");
  assert.equal(response.status, 200);

  const text = await response.text();

  assert.match(text, /<div id=app>POST<\/div>/);
}
