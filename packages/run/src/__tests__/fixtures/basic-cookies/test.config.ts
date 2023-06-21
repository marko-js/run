import * as assert from "assert";

export async function steps() {
  const expected = JSON.parse(await page.innerText("#app"));
  const actual: string[] = [];
  for (const { name, value } of await response!.headersArray()) {
    if (name === 'set-cookie') {
      actual.push(value)
    }
  }
  assert.deepEqual(actual, expected);
}
