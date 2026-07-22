import { Assert, Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => click(ctx),
];

// Preview shells out to the Wrangler CLI; like the other adapters' CLI-based
// preview tests, it is skipped here.
export const skip_preview = true;

// The Cloudflare plugin optimizes the worker's SSR dependencies on the first
// request and reloads the workerd module runner, which can cancel that
// in-flight request. The navigation fails before any snapshot is taken, so
// retrying the block absorbs the transient reload; a real failure still
// surfaces once the server has settled.
export const assert_dev: Assert = (_page, block) => retryInitialLoad(block);

async function retryInitialLoad(block: () => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await block();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function click({ page }: StepContext) {
  await page.click("button");
}
