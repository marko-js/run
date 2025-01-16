import assert from "assert";

export const steps = [
  () => requestHead(),
]

async function requestHead() {
  const url = new URL(page.url());
  const response = await page.request.fetch(url.href, { method: 'HEAD' });
  const headers = response.headers();
  assert.equal(response.ok(), true);
  assert.match(headers['content-type'], /text\/html/);
  assert.equal(await response.body(), '');
}