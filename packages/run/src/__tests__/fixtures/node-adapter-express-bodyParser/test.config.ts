import assert from "assert";

export const entry = 'src/index.ts';
export const steps = [() => submitPost()]

async function submitPost() {
  const expected = new FormData();
  expected.append("foo", "a");
  expected.append("bar", "b");

  const form = [...expected.entries()].reduce((acc, [key, value]) => {
    acc[key] = value.toString();
    return acc;
  }, {} as Record<string, string>);

  const response = await page.request.post(page.url(), { form });

  const html = await response.text();

  assert.equal(response.ok(), false);
  assert.match(await response.text(), /The request body stream was already consumed by something before Marko Run/);
}