import assert from "assert";

import type { Step, StepContext } from "../../main.test";

// The guard is dev-only, so a production build keeps the unchecked path.
export const skip_preview = true;

// Returning data instead of a Response used to reach the adapter, which
// failed reading `headers` off it and named only its own internals.
async function namesTheHandlerAndTheContract({ page }: StepContext) {
  const res = await page.fetch(new URL("/api", page.url()).href);
  assert.equal(res.status, 500);

  const body = await res.text();
  assert.doesNotMatch(body, /headers is not iterable/);
  assert.match(body, /GET \/api/);
  assert.match(body, /instead of a Response/);
  assert.match(body, /Response\.json/);
}

export const steps: Step[] = [(ctx) => namesTheHandlerAndTheContract(ctx)];
