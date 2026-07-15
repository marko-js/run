import assert from "assert";

import { StepContext } from "../../main.test";

export const steps = [
  requestHead,
]

async function requestHead({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: 'HEAD' });
  assert.equal(response.ok, true);
  assert.match(response.headers.get('content-type')!, /text\/html/);
  assert.equal(await response.text(), '');
}