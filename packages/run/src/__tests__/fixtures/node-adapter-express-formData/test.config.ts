import assert from "assert";

export const entry = "src/index.ts";

export async function steps() {
  const expected = new FormData();
  expected.append("foo", "a");
  expected.append("bar", "b");

  const form = [...expected.entries()].reduce((acc, [key, value]) => {
    acc[key] = value.toString();
    return acc;
  }, {} as Record<string, string>);

  const response = await page.request.post(page.url(), { form });

  assert.equal(response.ok(), true);
  debugger;

  const json = await response.json();
  const actual = json.formData;

  assert.deepEqual(actual, [...expected]);
}
