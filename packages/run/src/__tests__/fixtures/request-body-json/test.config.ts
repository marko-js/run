import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  post,
  postMalformed,
  postTooLarge,
  postBadEncoding,
  postUnconfiguredContentType,
];

async function postMalformed({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{oops",
  });
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "");
}

async function postTooLarge({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x".repeat(300), age: 7 }),
  });
  assert.equal(response.status, 413);
  assert.equal(await response.text(), "");
}

async function postBadEncoding({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    // `"x` followed by an invalid UTF-8 sequence.
    body: new Uint8Array([0x22, 0x78, 0xc3, 0x28]),
  });
  assert.equal(response.status, 400);
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

async function postUnconfiguredContentType({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hi",
  });
  assert.equal(response.status, 415);
}
