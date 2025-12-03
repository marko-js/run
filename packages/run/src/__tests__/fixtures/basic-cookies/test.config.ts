import * as assert from "assert";

import { StepContext } from "../../main.test";

export const steps = [readCookies]

async function readCookies({ response, page }: StepContext) {
  const expected = JSON.parse(await page.innerText("#app"));
  const actual: string[] = [];
  for (const { name, value } of await response.headersArray()) {
    if (name === 'set-cookie') {
      if (value.startsWith('marko-run-client-id=')) continue;
      actual.push(value)
    }
  }
  assert.deepEqual(actual, expected);
}
