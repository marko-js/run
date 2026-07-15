import * as assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [(ctx) => readCookies(ctx)];

async function readCookies({ response, page }: StepContext) {
  const expected = JSON.parse(page.innerText("#app"));
  const actual: string[] = [];
  for (const value of response.headers.getSetCookie()) {
    if (value.startsWith("marko-run-client-id=")) continue;
    actual.push(value);
  }
  assert.deepEqual(actual, expected);
}
