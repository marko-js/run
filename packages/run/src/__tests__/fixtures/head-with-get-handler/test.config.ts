import assert from "assert";

import { StepContext } from "../../main.test";

export const steps = [headRequest, getRequest];

async function headRequest({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/html/);
  assert.equal(await response.text(), "");
}

async function getRequest({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.fetch(url.href, { method: "GET" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /data from GET handler/);
}
