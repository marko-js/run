import assert from "assert";

import { StepContext } from "../../main.test";

export const steps = [
  requestHead,
]

async function requestHead({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.request.fetch(url.href, { method: 'HEAD' });
  const headers = response.headers();
  assert.equal(response.ok(), true);
  assert.match(headers['content-type'], /text\/html/);
  assert.equal(await response.body(), '');
}