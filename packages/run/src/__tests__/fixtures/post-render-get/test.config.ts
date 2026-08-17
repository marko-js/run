import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [renderViaNext("POST"), renderViaNext("QUERY")];

function renderViaNext(method: string): Step {
  return async ({ page }: StepContext) => {
    const response = await page.fetch(page.url(), { method });
    assert.equal(response.ok, true, `${method} failed`);
    assert.equal(response.status, 200);

    const text = await response.text();

    assert.match(text, new RegExp(`<div id=app>${method}</div>`));
  };
}
