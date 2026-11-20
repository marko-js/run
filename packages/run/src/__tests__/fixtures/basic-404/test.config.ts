import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const path = "/nowhere";

export const steps: Step[] = [(ctx) => variesOnAccept(ctx)];

// The 404 is HTML for a browser and empty for anything else, so a cache keyed
// on the URL alone would serve one to the other.
async function variesOnAccept({ page }: StepContext) {
  for (const accept of ["text/html", "application/json"]) {
    const response = await page.fetch("/nowhere", { headers: { accept } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("vary")!, /(^|,)\s*accept\s*(,|$)/i);
  }
}
