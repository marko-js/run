import assert from "assert";

import type { Step, StepContext } from "../../main.test";

export const path = "/api/procs/42";

async function deleteComment({ page }: StepContext) {
  const res = await page.fetch(
    new URL("/api/workspaces/w1/review/7", page.url()).href,
    { method: "DELETE" },
  );
  assert.deepEqual(await res.json(), { id: "w1", commentId: 7 });
}

export const steps: Step[] = [(ctx) => deleteComment(ctx)];
