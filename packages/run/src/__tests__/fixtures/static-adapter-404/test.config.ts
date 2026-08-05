import assert from "assert";

import type { StepContext } from "../../main.test";

// The prerendered `+404` page has to answer with a real 404 status. In preview
// it is served by sirv, whose `send` writes a hardcoded 200 after the
// `setHeaders` hook runs, so a status assigned there never reached the client.
async function notFoundPageHasNotFoundStatus({ page }: StepContext) {
  const response = await page.fetch("/404", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 404);
  assert.match(await response.text(), /404/);
}

export const steps = [notFoundPageHasNotFoundStatus];
