import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post, postMalformed, postTooLarge];

async function postMalformed({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{oops",
  });
  assert.equal(response.status, 400);
}

async function postTooLarge({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x".repeat(300), age: 7 }),
  });
  assert.equal(response.status, 413);
}

async function post({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "MarkoRun",
      age: 7,
    }),
  });
  assert.equal(response.ok, true, "Post failed");

  const json = await response.json();

  assert.equal(json.issues, null);
}
