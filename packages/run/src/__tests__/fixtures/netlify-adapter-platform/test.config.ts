import * as assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [(ctx) => setsCookie(ctx)];
export const skip_preview = true;

async function setsCookie({ response }: StepContext) {
  assert.ok(
    response.headers
      .getSetCookie()
      .includes("visited=yes; Path=/; HttpOnly"),
  );
}
