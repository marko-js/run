import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [query, queryInvalidBody, get];

async function query({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "QUERY",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ search: "marko" }),
  });
  assert.equal(response.ok, true, "Query failed");
  assert.equal(response.status, 200);

  const text = await response.text();

  assert.match(text, /<div id=app>Results for marko<\/div>/);
}

async function queryInvalidBody({ page }: StepContext) {
  const response = await page.fetch(page.url(), {
    method: "QUERY",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ search: 1 }),
  });
  assert.equal(response.status, 400);
}

async function get({ page }: StepContext) {
  const response = await page.fetch(page.url());
  assert.equal(response.status, 200);

  const text = await response.text();

  assert.match(text, /<div id=app>Results for <\/div>/);
}
