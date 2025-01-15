import assert from "assert";

export const steps = [
  () => assertBody('POST'),
  () => assertBody('PUT'),
  () => assertBody('DELETE'),
  () => assertBody('PATCH'),
  () => assertNoBody('HEAD'),
  () => assertNoBody('OPTIONS')
]

async function assertBody(method: string) {
  const url = new URL(page.url());
  const response = await page.request.fetch(url.href, { method });
  
  assert.equal(response.ok(), true, `Response for ${method} is not ok`);
  const body = await response.text();
  assert.equal(body, `handler: ${method} ${url.pathname}`, `Response for ${method} has an unexpected body: "${body}"`);
}

async function assertNoBody(method: string) {
  const url = new URL(page.url());
  const response = await page.request.fetch(url.href, { method });
  assert.equal(response.ok(), true, `Response for ${method} is not ok`);
  const body = await response.text();
  assert.equal(body, '', `Response for ${method} has a non-empty body: "${body}"`);
}